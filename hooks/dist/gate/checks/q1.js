import { join } from 'node:path';
import { read } from "../../lib.js";
import { isRecord, parseJsonc } from "../read-config.js";
import { AFFIRM, GENERIC_SUBPATHS, NEGATION, OBVIOUS_SCRIPTS, SCRIPT_SYNONYMS, STACK_LABELS, STACK_NEUTRAL, STACK_VERB_LABELS, TECH, } from "../tables/alias.js";
import { ABSOLUTE, citedPaths, citedScripts, hasReason, mentions, onlyConnectives, similarity, spans, words } from "../text.js";
import { PM_COMMANDS, alive, clean } from "./q7.js";
// Question 1: does the repository already say what this rule says?
const WB_BEFORE = String.raw `(?<![\p{L}\p{N}_-])`;
const WB_AFTER = String.raw `(?![\p{L}\p{N}_-])`;
const DEP_GROUPS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
// Verbs that turn a list item into an instruction rather than a description.
const IMPERATIVE = new Set([
    'use', 'run', 'add', 'keep', 'never', 'always', 'do', 'don', 'avoid', 'write', 'prefer', 'make', 'ensure', 'put', 'place', 'create',
    'update', 'call', 'follow', 'check', 'read', 'import', 'install', 'remember', 'try', 'put', 'must', 'should',
    'usa', 'usar', 'ejecuta', 'a\u00f1ade', 'evita', 'escribe', 'mant\u00e9n', 'haz', 'crea', 'sigue', 'revisa', 'lee', 'nunca', 'siempre',
]);
// What may remain of a technology rule once the template and the names are removed.
const STOPWORDS = new Set([
    'and', 'with', 'the', 'a', 'an', 'for', 'our', 'this', 'project', 'as', 'in', 'of', 'repo', 'app', 'codebase',
    'y', 'con', 'el', 'la', 'para', 'este', 'proyecto', 'en', 'como',
]);
// Words a title may carry besides the package name.
const FILLER = new Set([
    'project', 'instructions', 'guide', 'guidelines', 'claude', 'agents', 'md', 'for', 'the', 'repo', 'repository',
    'proyecto', 'instrucciones', 'guía', 'guia', 'guías', 'para', 'el', 'la', 'de', 'del', 'repositorio',
]);
// All that may surround an obvious script: neutral words, and the words of that script's own job. A job
// word of another script ("`npm run lint` to format") or any other word is information about the command.
const SCRIPT_NEUTRAL = new Set([
    'run', 'running', 'runs', 'use', 'using', 'command', 'commands', 'script', 'scripts', 'the', 'a', 'to', 'for', 'via', 'with', 'and',
    'our', 'all', 'this', 'project',
    'ejecuta', 'ejecutar', 'corre', 'usa', 'usar', 'comando', 'script', 'el', 'la', 'los', 'las', 'para', 'con', 'y', 'de', 'del', 'este',
    'proyecto', 'todos', 'todas',
]);
const SCRIPT_JOB = {
    test: new Set(['test', 'tests', 'testing', 'suite', 'unit', 'pruebas']),
    lint: new Set(['lint', 'linter', 'linting']),
    build: new Set(['build', 'builds', 'compile', 'compila', 'compilar']),
    dev: new Set(['dev', 'development', 'server', 'desarrollo', 'servidor']),
    start: new Set(['start', 'starts', 'server', 'inicia', 'arranca', 'servidor']),
    format: new Set(['format', 'formatter', 'formatting', 'formatea', 'formato']),
    typecheck: new Set(['typecheck', 'types', 'type', 'check']),
};
const TIMING = new Set(['before', 'after', 'always', 'when', 'until', 'once', 'every', 'antes', 'después', 'siempre', 'cuando', 'hasta', 'cada']);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const answer = (code, evidence) => ({ verdict: 'cut', code, question: 1, evidence });
const isReadme = (file) => file.split('/').pop() === 'README.md';
const MENTION = new Map(TECH.map((t) => [
    t, new RegExp(`${WB_BEFORE}(?:${[t.name, ...t.aliases].map(escape).join('|')})${WB_AFTER}`, 'gu'),
]));
const AFFIRM_G = AFFIRM.map((r) => new RegExp(r.source, r.flags.includes('g') ? r.flags : `${r.flags}g`));
const has = (text, re) => text.search(re) >= 0;
function inferableTitle(rule, facts) {
    if (rule.kind !== 'heading')
        return null; // a paragraph says more than a title, wherever it sits
    const name = facts.pkg?.name;
    if (name !== null && name !== undefined && name !== '') {
        const last = name.split('/').pop() ?? name;
        if (mentions(rule.text, name) || mentions(rule.text, last)) {
            const own = new Set([...words(name), ...words(last)]);
            const others = words(rule.text).filter((w) => !own.has(w) && !FILLER.has(w));
            if (others.length === 0 && !ABSOLUTE.test(rule.text) && !NEGATION.test(rule.text))
                return answer('inferable-title', `${facts.pkg?.path ?? 'package.json'}: name`);
        }
    }
    const readme = facts.docs.find((d) => isReadme(d.file));
    if (readme !== undefined && similarity(rule.text, readme.text) > 0.8)
        return answer('inferable-title', readme.file);
    return null;
}
// Existing files or directories, as paths without a trailing slash.
function pathExists(p, facts, dirs) {
    return facts.files.has(p) || dirs().has(p);
}
const instructs = (text) => words(text).some((w) => IMPERATIVE.has(w)) || NEGATION.test(text) || ABSOLUTE.test(text);
// A drawn tree whose entries exist in the repository and carry no comment: a comment can hold a gotcha
// ("# to be removed", "# moved to lib"), and a plain description cannot be told apart from one.
function treeIsReal(text, facts) {
    const names = new Set();
    for (const f of facts.files)
        for (const seg of f.split('/'))
            names.add(seg);
    let hits = 0;
    for (const line of text.split('\n')) {
        if (line.startsWith('```') || line.startsWith('~~~'))
            continue;
        if (instructs(line))
            return false;
        const body = line.replace(/^[\s│├└─|+\\`-]+/, '');
        const gap = body.search(/\s/);
        const entry = (gap < 0 ? body : body.slice(0, gap)).replace(/[/:]+$/, '');
        if (gap >= 0 && body.slice(gap).trim() !== '')
            return false;
        if (entry !== '' && names.has(entry))
            hits++;
    }
    return hits >= 2;
}
function inferableTree(rule, facts) {
    if (rule.kind === 'code')
        return (rule.text.includes('\u251c') || rule.text.includes('\u2514')) && treeIsReal(rule.text, facts) ? answer('inferable-tree', 'repository file tree') : null;
    if (rule.kind !== 'item' && rule.kind !== 'steps')
        return null;
    let dirSet = null;
    const dirs = () => {
        if (dirSet === null) {
            dirSet = new Set();
            for (const f of facts.files)
                for (let i = f.indexOf('/'); i >= 0; i = f.indexOf('/', i + 1))
                    dirSet.add(f.slice(0, i));
        }
        return dirSet;
    };
    const found = [];
    for (const line of rule.text.split('\n')) {
        const body = LIST_ITEM.exec(line)?.[1]?.trim();
        if (body === undefined)
            continue;
        const cut = body.search(/\s/);
        if (cut < 0)
            continue;
        const path = body.slice(0, cut).replace(/^`|[`:,]+$/g, '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
        const rest = body.slice(cut).replace(/^[\s:\u2013\u2014-]+/, '');
        if (path === '' || words(rest).length === 0 || instructs(rest))
            continue;
        if (pathExists(path, facts, dirs))
            found.push(path);
    }
    return found.length >= 3 ? answer('inferable-tree', `paths: ${found.slice(0, 3).join(', ')}`) : null;
}
function inferableScript(rule, facts) {
    const all = spans(rule.text);
    const span = all[0];
    if (all.length !== 1 || span === undefined || facts.pkg === null)
        return null;
    const m = /^(npm|pnpm|yarn|bun)\s+(run\s+)?([\w:.-]+)$/.exec(span.trim());
    const pm = m?.[1];
    const script = m?.[3];
    if (pm === undefined || script === undefined || !OBVIOUS_SCRIPTS.includes(script))
        return null;
    if (m?.[2] === undefined && pm === 'npm' && script !== 'test' && script !== 'start')
        return null; // `npm lint` is not a command
    if (!Object.hasOwn(facts.pkg.scripts, script))
        return null;
    const outside = rule.text.replace(LIST_MARKER, '').replace(`\`${span}\``, ' ');
    if (/[\d/\\_`@$=<>]|\w\.\w/.test(outside))
        return null; // a number, a path or an identifier is information
    const around = words(outside);
    const job = SCRIPT_JOB[script];
    if (around.length > 4 || !around.every((w) => SCRIPT_NEUTRAL.has(w) || job?.has(w) === true))
        return null;
    if (around.some((w) => TIMING.has(w)) || ABSOLUTE.test(outside) || NEGATION.test(outside))
        return null;
    return answer('inferable-script', `${facts.pkg.path}: scripts.${script}`);
}
// Which dependency group of package.json holds `name`.
function depGroup(facts, name) {
    const text = facts.pkg === null ? null : read(join(facts.root, facts.pkg.path));
    const parsed = text === null ? null : parseJsonc(text);
    if (isRecord(parsed)) {
        for (const g of DEP_GROUPS) {
            const group = parsed[g];
            if (isRecord(group) && Object.hasOwn(group, name))
                return g;
        }
    }
    return 'dependencies';
}
// The evidence that the repository uses `t`, or null when it does not.
function presence(t, facts) {
    if (t.category === 'language') {
        const lang = t.language ?? t.name;
        return facts.languages[0] === lang ? `file listing: ${lang}` : null; // only the leading language is "the" language
    }
    const pkg = t.packages?.find((p) => facts.pkg?.deps.has(p));
    if (pkg !== undefined && facts.pkg !== null)
        return `${facts.pkg.path}: ${depGroup(facts, pkg)}.${pkg}`;
    if (t.lockfile !== undefined && facts.lockfiles.has(t.lockfile))
        return t.lockfile;
    if (t.language !== undefined && facts.languages.includes(t.language))
        return `file listing: ${t.language}`;
    return null;
}
function inferableTech(rule, facts) {
    if (rule.kind === 'code')
        return null;
    const text = rule.text;
    if (!AFFIRM.some((r) => r.test(text)) || NEGATION.test(text))
        return null;
    // Inside a code span a name counts whatever its case: capitalise it so the table's spellings match.
    const plain = text.replace(/`([^`\n]+)`/g, (_, s) => s.charAt(0).toUpperCase() + s.slice(1));
    const mentioned = TECH.filter((t) => has(plain, MENTION.get(t) ?? /$^/u));
    if (mentioned.length === 0)
        return null;
    const present = new Map();
    for (const t of TECH) {
        const e = presence(t, facts);
        if (e !== null)
            present.set(t, e);
    }
    const evidence = [];
    for (const t of mentioned) {
        const e = present.get(t);
        if (e === undefined || t.replacesDefault === true)
            return null;
        if ([...present.keys()].some((o) => o !== t && o.category === t.category))
            return null;
        evidence.push(e);
    }
    let rest = plain;
    for (const r of AFFIRM_G)
        rest = rest.replace(r, ' ');
    for (const t of mentioned)
        rest = rest.replace(MENTION.get(t) ?? /$^/u, ' ');
    return onlyConnectives(rest, STOPWORDS) ? answer('inferable-tech', evidence.join('; ')) : null;
}
function inferableOverview(rule, facts) {
    if (rule.kind !== 'paragraph')
        return null;
    if (spans(rule.text).length > 0 || citedPaths(rule.text).length > 0)
        return null;
    if (rule.text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim() !== '').length < 2)
        return null;
    const doc = facts.docs.find((d) => isReadme(d.file) && similarity(rule.text, d.text) > 0.8);
    return doc === undefined ? null : answer('inferable-overview', doc.file);
}
// ---- Phase 1.1: shape detectors that use the repository as their dictionary ----
// Words that make a description say more than what a thing is. Each list is closed; ante la duda, abstain.
// A state the reader cannot see in the file listing.
const STATE = new Set([
    'generated', 'autogenerated', 'auto', 'codegen', 'legacy', 'deprecated', 'obsolete', 'frozen', 'experimental', 'internal', 'private',
    'vendored', 'vendor', 'temporary', 'temp', 'tmp', 'wip', 'readonly', 'draft', 'unstable', 'beta', 'alpha', 'unused', 'dead', 'old',
    'broken', 'flaky', 'fragile', 'sensitive', 'secret', 'secrets', 'manual', 'manually', 'handwritten', 'todo', 'fixme', 'hack', 'hacky',
    'workaround', 'critical', 'important', 'careful', 'caution', 'warning', 'danger', 'dangerous', 'risky', 'slow', 'fork', 'forked',
    'patched', 'upstream', 'mirror', 'duplicate', 'production', 'prod', 'staging', 'live',
    'generado', 'generada', 'autogenerado', 'autogenerada', 'heredado', 'heredada', 'obsoleto', 'obsoleta', 'congelado', 'congelada',
    'experimentales', 'interno', 'interna', 'privado', 'privada', 'temporal', 'provisional', 'borrador', 'roto', 'rota', 'antiguo', 'viejo',
    'manualmente', 'crítico', 'importante', 'cuidado', 'peligroso', 'lento', 'producción',
]);
// Effect verbs, modals and requests: a description that hides a warning without a listed word uses one of these.
const EFFECT = new Set([
    'applied', 'applies', 'apply', 'loaded', 'loads', 'load', 'required', 'requires', 'require', 'must', 'needs', 'need', 'needed',
    'overrides', 'override', 'overridden', 'shared', 'runs', 'ran', 'imported', 'imports', 'used', 'depends', 'depend', 'dependent',
    'consumed', 'consumes', 'called', 'invoked', 'invokes', 'triggered', 'triggers', 'mounted', 'injected', 'deployed', 'deploys',
    'published', 'publishes', 'synced', 'syncs', 'synchronized', 'synchronised', 'copied', 'mirrored', 'mirrors', 'replaced', 'replaces',
    'moved', 'migrated', 'owned', 'owns', 'served', 'exposed', 'expected', 'should', 'shall', 'will', 'would', 'may', 'might', 'can', 'could',
    'then', 'first', 'ask', 'see', 'consult', 'confirm', 'contact', 'ping', 'talk', 'beware', 'note',
    'aplicado', 'aplica', 'cargado', 'carga', 'requerido', 'requiere', 'necesita', 'necesitan', 'debe', 'deben', 'sobrescribe', 'compartido',
    'compartida', 'ejecuta', 'ejecutado', 'importado', 'importa', 'usado', 'usada', 'depende', 'dependen', 'consumido', 'invocado',
    'desplegado', 'publicado', 'sincronizado', 'copiado', 'reemplaza', 'movido', 'migrado', 'puede', 'pueden', 'pregunta', 'consulta',
    'confirma', 'mira', 'ver', 'primero', 'luego',
    // Instructions in the base form that IMPERATIVE does not list: "`src/Sample/` - Remove sample component".
    'remove', 'delete', 'rename', 'edit', 'modify', 'change', 'fix', 'rewrite', 'refactor', 'ignore', 'skip', 'touch', 'configure', 'set',
    'register', 'stop', 'review', 'regenerate', 'rebuild', 'restart', 'replace', 'move', 'copy', 'extend', 'wrap', 'export',
    'elimina', 'borra', 'renombra', 'edita', 'modifica', 'cambia', 'arregla', 'ignora', 'mueve', 'copia', 'reemplaza',
]);
// A description speaks of the thing; a pronoun speaks to or about the reader.
const PRONOUN = new Set(['you', 'your', 'yours', 'we', 'our', 'us', 'it', 'them', 'i', 'me', 'my', 'tú', 'tu', 'nosotros', 'nuestro', 'nuestra']);
const QUANTIFIER = new Set(['every', 'each', 'any', 'all', 'cada', 'todos', 'todas', 'cualquier']);
const CONDITION = new Set(['if', 'when', 'whenever', 'unless', 'before', 'after', 'until', 'once', 'while', 'si', 'cuando', 'antes', 'después', 'hasta', 'mientras']);
// A script whose name, command or rule touches one of these has effects a rule may rightly warn about.
const RISKY = new Set([
    'deploy', 'deploys', 'deployment', 'publish', 'release', 'releases', 'prod', 'production', 'staging', 'live', 'drop', 'reset', 'wipe',
    'destroy', 'delete', 'purge', 'nuke', 'force', 'migrate', 'migration', 'migrations', 'seed', 'rollback', 'push', 'upload', 'sync',
]);
// Verbs a script description may open with besides the words of the script itself.
const SCRIPT_VERBS = new Set([
    'run', 'runs', 'execute', 'executes', 'create', 'creates', 'generate', 'generates', 'start', 'starts', 'launch', 'launches', 'perform',
    'performs', 'produce', 'produces', 'ejecuta', 'crea', 'genera', 'inicia', 'lanza', 'in', 'on', 'of', 'mode', 'files', 'code', 'en',
]);
// Words of a command that say nothing of what the script does.
const COMMAND_NOISE = new Set(['node', 'npx', 'npm', 'pnpm', 'yarn', 'bun', 'exec', 'dlx', 'run', 'env', 'cross', 'true', 'false', 'echo', 'exit', 'if', 'then', 'else', 'and', 'or', 'not', 'only', 'no']);
// What an overview may hold besides its content words.
const FUNCTION_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'be', 'it', 'its', 'this', 'that', 'which', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by',
    'as', 'at', 'from', 'into', 'via', 'both', 'also', 'has', 'have', 'their', 'there', 'these', 'those', 'such', 'than', 'so',
    'el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'de', 'del', 'y', 'o', 'en', 'con', 'para', 'por', 'que', 'se', 'su', 'sus', 'al', 'como',
]);
// A path: a slash or a file extension.
const PATH_SHAPE = /\/|\.(?:[cm]?[jt]sx?|vue|svelte|astro|md|mdx|json|jsonc|ya?ml|toml|txt|sh|py|go|rs|css|scss|sass|less|html|sql|rb|java|kt|swift|php|cs|lua|ex|exs|proto|graphql|prisma)$/i;
const LATIN = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;
// The longest rule a shape detector reads: a description of 25 words, a stack line, a script line. A longer
// rule is something else, and the bound keeps every pattern below cheap on any input.
const SHORT = 600;
const SEPARATOR = /^\s*(?:[:–—]|-{1,2}(?=\s))\s*/;
const stem = (w) => (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
// Is `text` a plain description of up to 25 words: nothing a reader must act on, beware of or check?
// `allowedSpan` decides each code span; a span it refuses makes the text more than a description.
function plainDescription(text, allowedSpan) {
    if (!LATIN.test(text) || /\d|https?:|www\./.test(text) || NEGATION.test(text) || ABSOLUTE.test(text))
        return false;
    if (!spans(text).every(allowedSpan))
        return false;
    const bare = text.replace(/`[^`\n]*`/g, ' ');
    // A second sentence or a clause after ";" or a dash is a remark about the thing, not its description.
    if (/[.!?](?:\s+\S)/.test(bare.replace(/\b(?:e\.g|i\.e|etc|vs)\./gi, '')) || hasReason(bare) || /\s-{1,2}\s/.test(bare))
        return false;
    const w = words(bare);
    if (w.length === 0 || w.length > 25)
        return false;
    const gerund = (x) => x !== 'using' && x.endsWith('ing') && (IMPERATIVE.has(x.slice(0, -3)) || IMPERATIVE.has(`${x.slice(0, -3)}e`) || IMPERATIVE.has(x.slice(0, -4)));
    return !w.some((x) => IMPERATIVE.has(x) || gerund(x) || TIMING.has(x) || CONDITION.has(x) || STATE.has(x) || EFFECT.has(x) || PRONOUN.has(x) || QUANTIFIER.has(x));
}
// The path a token names, or null when it does not look like one.
function pathToken(raw) {
    const p = clean(raw.trim().replace(/^\/+/, ''));
    if (p === '' || /[\s*?{}<>[\]]/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('..') || p.startsWith('~'))
        return null;
    return PATH_SHAPE.test(p) || raw.includes('/') ? p : null;
}
const exists = (p, facts) => facts.inRepo && facts.filesKnown && alive(p, facts);
const spanIsLivePath = (facts) => (s) => { const p = pathToken(s); return p !== null && exists(p, facts); };
// "- `lib/nvidia.js` — Executes nvidia-smi", "- **Cache** (lib/cache.js:5): In-memory LRU cache".
const PATH_FIRST = /^(?:\*\*`([^`\n]{1,200})`\*\*|`([^`\n]{1,200})`|\*\*([^*`\n]{1,200}?):?\*\*|([^\s`*():]{1,200}))/;
const NAME_THEN_PATH = /^(\*\*[^*\n]{1,60}\*\*|`[^`\n]{1,60}`|[\p{L}][\p{L}\p{N} _-]{0,40}?)\s*\(\s*`?([^()`\s]{1,200})`?\s*\)/u;
export const describedPath = (rule, facts) => {
    if (rule.kind !== 'item' || rule.lines !== 1 || rule.text.length > SHORT)
        return null;
    const body = rule.text.replace(LIST_MARKER, '').trim();
    let path;
    let name = '';
    let rest;
    const named = NAME_THEN_PATH.exec(body);
    if (named !== null) {
        path = pathToken(named[2] ?? '');
        name = (named[1] ?? '').replace(/[*`]/g, '');
        rest = body.slice(named[0].length);
    }
    else {
        const m = PATH_FIRST.exec(body);
        if (m === null)
            return null;
        path = pathToken(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
        rest = body.slice(m[0].length);
    }
    const sep = SEPARATOR.exec(rest);
    if (path === null || sep === null)
        return null;
    const description = rest.slice(sep[0].length);
    if (name !== '' && !plainDescription(name, () => false))
        return null;
    if (!plainDescription(description, spanIsLivePath(facts)) || !toolsAreDeps(description, facts))
        return null;
    return exists(path, facts) ? answer('inferable-path', `path: ${path}`) : null;
};
const DEP_INDEX = new WeakMap();
const depKey = (s) => s.toLowerCase().replace(/(?:\.?js)$/, (m) => (s.length - m.length >= 2 ? '' : m)).replace(/[\s._/@-]+/g, '');
function depIndex(facts) {
    const cached = DEP_INDEX.get(facts);
    if (cached !== undefined)
        return cached;
    const full = new Map();
    const last = new Map();
    for (const d of facts.pkg?.deps ?? []) {
        if (d.startsWith('@types/'))
            continue; // typings say nothing of the runtime or its version
        const k = depKey(d);
        if (!full.has(k))
            full.set(k, d);
        const tail = d.startsWith('@') ? d.split('/')[1] : undefined;
        if (tail !== undefined && !GENERIC_SUBPATHS.has(tail.toLowerCase())) {
            const t = depKey(tail);
            if (!last.has(t))
                last.set(t, d);
        }
    }
    const index = { full, last };
    DEP_INDEX.set(facts, index);
    return index;
}
const TECH_BY_SPELLING = new Map(TECH.flatMap((t) => [t.name, ...t.aliases].map((n) => [n, t])));
// The dependency a written name stands for, or null.
function resolveDep(name, facts) {
    const tech = TECH_BY_SPELLING.get(name);
    if (tech?.replacesDefault === true)
        return null;
    const { full, last } = depIndex(facts);
    const k = depKey(name);
    const hit = full.get(k) ?? last.get(k);
    if (hit !== undefined)
        return hit;
    return tech?.packages?.find((p) => !p.startsWith('@types/') && facts.pkg?.deps.has(p) === true) ?? null;
}
// Is another technology of the same kind in the manifest? Then naming one of them ("Testing: Jest" next to
// vitest) says which is used for what, as question 1 already assumes for "use X".
// A rival the rule names too ("Next.js · React") is no choice between them.
function rivalPresent(dep, facts, named = new Set()) {
    const own = TECH.find((t) => t.packages?.includes(dep) === true);
    if (own === undefined)
        return false;
    return TECH.some((t) => t !== own && t.category === own.category && t.packages?.some((p) => facts.pkg?.deps.has(p) === true) === true &&
        !t.packages.some((p) => named.has(p)));
}
// "MCP server using fastmcp": the tool a description names after "using" or "via" must be a dependency, or
// the description may be stale (the manifest lists another one) and is not the repository's to repeat.
const TOOL_SLOT = /(?<![\p{L}\p{N}_-])(?:using|via|powered\s+by|built\s+(?:on|with)|mediante|usando)\s+(?:(?:the|a|an|el|la)\s+)?([\p{L}@][\p{L}\p{N}@/._-]{0,60})/giu;
function toolsAreDeps(text, facts) {
    for (const m of text.matchAll(TOOL_SLOT)) {
        const tool = (m[1] ?? '').replace(/[.]+$/, '');
        if (resolveDep(tool, facts) === null)
            return false;
    }
    return true;
}
// The major version of a plain range ("^19.0.0", "~5.7", "18.x"), or null when the range is anything else.
function majorOf(range) {
    const m = /^[\^~]?v?(\d+)(?:\.(?:\d+|x|\*)){0,2}$/.exec(range.trim());
    return m?.[1] === undefined ? null : Number(m[1]);
}
const LABEL = /^(?:\*\*([^*\n]{1,40}?):?\*\*:?|([\p{L}][\p{L} ]{0,30}?):)\s*/u;
const VERSION = /\s+v?(\d+)(?:\.(?:\d+|x))*(\uE003)?$/;
// One segment of a stack list, or null when it is anything but a dependency with an optional version,
// neutral role words and a parenthesis of neutral words or other dependencies.
function segment(raw, held, restore, facts) {
    let s = raw.trim().replace(/[.]+$/, '');
    for (const m of s.matchAll(/\uE001(\d+)\uE001/g)) {
        const inner = restore(held[Number(m[1])] ?? '');
        const parts = inner.split(/\s*(?:,|\+|\/|\band\b)\s*/);
        if (!parts.every((p) => words(p).every((w) => STACK_NEUTRAL.has(w)) || resolveDep(p.replace(/[`*]/g, '').trim(), facts) !== null))
            return null;
    }
    s = s.replace(/\s*\uE001\d+\uE001\s*/g, ' ').trim();
    const marked = /^\*\*.*\*\*$|^`.*`$/.test(s);
    s = s.replace(/^\*\*|\*\*$/g, '').replace(/^`|`$/g, '').trim();
    const stripRoles = (x) => {
        let out = x;
        for (let w = /\s+([\p{L}-]+)$/u.exec(out); w !== null && words(w[1] ?? '').every((y) => STACK_NEUTRAL.has(y)); w = /\s+([\p{L}-]+)$/u.exec(out)) {
            if (resolveDep(out, facts) !== null)
                break;
            out = out.slice(0, w.index);
        }
        return out;
    };
    s = stripRoles(s);
    const v = VERSION.exec(s);
    if (v !== null)
        s = stripRoles(s.slice(0, v.index));
    const dep = s === '' ? null : resolveDep(s, facts); // a digit left in the name must belong to a dependency's name
    if (dep === null)
        return null;
    return { dep, marked: marked || /^[\p{Lu}@]|[.\-/@]/u.test(s), major: v === null ? null : Number(v[1]), orLater: v?.[2] !== undefined, text: raw.trim() };
}
export const stackList = (rule, facts) => {
    const pkg = facts.pkg;
    if (pkg === null || pkg.deps.size === 0 || rule.lines !== 1 || rule.text.length > SHORT || (rule.kind !== 'item' && rule.kind !== 'paragraph'))
        return null;
    const text = rule.text.replace(LIST_MARKER, '').trim();
    if (NEGATION.test(text) || ABSOLUTE.test(text) || !LATIN.test(text))
        return null;
    // "**dependency**: description": the abstentions of a described path.
    const own = /^(?:\*\*`?([^*`\n]{1,60}?)`?\*\*|`([^`\n]{1,60})`)\s*(?:[:–—]|-{1,2}(?=\s))\s*(.+)$/.exec(text);
    const ownName = own?.[1] ?? own?.[2];
    if (own !== null && ownName !== undefined && !STACK_LABELS.has(ownName.toLowerCase())) {
        const dep = resolveDep(ownName.trim(), facts);
        const description = own[3] ?? '';
        if (dep === null || rule.kind !== 'item' || rivalPresent(dep, facts))
            return null;
        if (!plainDescription(description, spanIsLivePath(facts)) || !toolsAreDeps(description, facts))
            return null;
        return answer('inferable-stack', `${pkg.path}: ${depGroup(facts, dep)}.${dep}`);
    }
    // A list, after an optional label from the closed list.
    let list = text;
    let labelled = false;
    const verb = STACK_VERB_LABELS.find((l) => list.toLowerCase().startsWith(`${l} `) || list.toLowerCase().startsWith(`${l}:`));
    if (verb !== undefined) {
        list = list.slice(verb.length).replace(/^\s*:?\s*/, '');
        labelled = true;
    }
    else {
        const l = LABEL.exec(list);
        if (l !== null) {
            if (!STACK_LABELS.has((l[1] ?? l[2] ?? '').trim().toLowerCase()))
                return null; // an unknown label says something
            list = list.slice(l[0].length);
            labelled = true;
        }
    }
    if (!labelled && rule.kind !== 'item')
        return null; // in a paragraph, "debug and colors" is prose
    const held = [];
    const hold = (re, mark, x) => x.replace(re, (m) => { held.push(m); return `${mark}${held.length - 1}${mark}`; });
    list = hold(/`[^`\n]+`/g, '\uE002', list);
    list = hold(/@[\w.-]+\/[\w.-]+/g, '\uE002', list);
    list = list.replace(/\(([^()\n]{0,120})\)/g, (_, inner) => { held.push(inner); return `\uE001${held.length - 1}\uE001`; });
    if (/[()]/.test(list))
        return null;
    list = list.replace(/(\d)\+/g, '$1\uE003');
    const raw = list.split(/\s*(?:,|·|\||\+|\/|&|(?<![\p{L}])(?:and|y)(?![\p{L}]))\s*/u).filter((x) => x.trim() !== '');
    if (raw.length === 0 || raw.length > 15 || (!labelled && raw.length < 2))
        return null;
    const restore = (x) => x.replace(/\uE002(\d+)\uE002/g, (_, i) => held[Number(i)] ?? '');
    const segs = [];
    for (const r of raw) {
        const seg = segment(restore(r), held, restore, facts);
        if (seg === null)
            return null;
        segs.push(seg);
    }
    const named = new Set(segs.map((x) => x.dep));
    if (segs.some((x) => rivalPresent(x.dep, facts, named)))
        return null;
    if (!segs.some((x) => x.marked))
        return null; // lowercase ordinary words alone ("debug and colors") are prose
    for (const seg of segs) {
        if (seg.major === null)
            continue;
        const range = pkg.versions[seg.dep] ?? '';
        const major = majorOf(range);
        if (major === null)
            return null; // a version the manifest cannot confirm is information
        if (seg.orLater ? major < seg.major : major !== seg.major) {
            return { verdict: 'conflict', code: 'stale-version', question: 1, evidence: `${pkg.path}: ${depGroup(facts, seg.dep)}.${seg.dep} is ${range}; the rule says "${seg.text}"` };
        }
    }
    return answer('inferable-stack', `${pkg.path}: ${[...new Set(segs.map((x) => `${depGroup(facts, x.dep)}.${x.dep}`))].join(', ')}`);
};
// The words a script may be described with: its name's parts, its command's words, and their synonyms.
const SYNONYMS = new Map(SCRIPT_SYNONYMS.flatMap((g) => g.map((w) => [w, g])));
function scriptWords(name, command) {
    const own = new Set();
    for (const w of [...words(name.replace(/[:._-]/g, ' ')), ...words(command).filter((x) => x.length >= 3 && !COMMAND_NOISE.has(x))]) {
        for (const v of [w, stem(w)]) {
            own.add(v);
            for (const syn of SYNONYMS.get(v) ?? [])
                own.add(syn);
        }
    }
    return own;
}
export const describedScript = (rule, facts) => {
    const pkg = facts.pkg;
    if (pkg === null || rule.lines !== 1 || rule.text.length > SHORT || (rule.kind !== 'item' && rule.kind !== 'paragraph'))
        return null;
    const all = spans(rule.text);
    const span = all[0];
    if (all.length !== 1 || span === undefined)
        return null;
    const m = /^(npm|pnpm|yarn|bun)\s+(run\s+)?([\w:.-]+)$/.exec(span.trim());
    const cited = citedScripts(`\`${span}\``)[0];
    const script = m?.[3];
    if (m === null || cited === undefined || script === undefined || !Object.hasOwn(pkg.scripts, script))
        return null;
    // With other package.json files in the tree a script of the same name may be theirs, as question 7 assumes.
    if ([...facts.files].some((f) => (f === 'package.json' || f.endsWith('/package.json')) && f !== pkg.path))
        return null;
    if (!cited.explicit && (cited.pm === 'npm' ? script !== 'test' && script !== 'start' : PM_COMMANDS.has(script)))
        return null;
    const command = pkg.scripts[script] ?? '';
    const outside = rule.text.replace(LIST_MARKER, '').replace(`\`${span}\``, ' ').replace(SEPARATOR, '').trim();
    if (/[\d/\\_`@$=<>]|\w\.\w/.test(outside) || hasReason(outside) || NEGATION.test(outside) || ABSOLUTE.test(outside) || !LATIN.test(outside))
        return null;
    const around = words(outside);
    const own = scriptWords(script, command);
    if (around.length > 12 || [...words(script.replace(/[:._-]/g, ' ')), ...words(command), ...around].some((w) => RISKY.has(w)))
        return null;
    if (around.some((w) => TIMING.has(w) || CONDITION.has(w) || EFFECT.has(w) || STATE.has(w) || PRONOUN.has(w)))
        return null;
    const known = (w) => SCRIPT_NEUTRAL.has(w) || SCRIPT_VERBS.has(w) || own.has(w) || own.has(stem(w));
    return around.every(known) ? answer('inferable-script', `${pkg.path}: scripts.${script}`) : null;
};
// The words an overview may be made of: the manifest's description and name, the first three prose
// paragraphs of the README, and the dependency names. Computed once per Facts.
const OVERVIEW_WORDS = new WeakMap();
function overviewWords(facts) {
    const cached = OVERVIEW_WORDS.get(facts);
    if (cached !== undefined)
        return cached;
    const out = new Set();
    const add = (text) => { for (const w of words(text)) {
        out.add(w);
        out.add(stem(w));
    } };
    const sources = [];
    const pkg = facts.pkg;
    if (pkg !== null) {
        add(pkg.name ?? '');
        if (pkg.description !== null) {
            add(pkg.description);
            sources.push(`${pkg.path}: description`);
        }
        for (const d of pkg.deps) {
            const tail = d.split('/').pop() ?? d;
            out.add(d.toLowerCase());
            out.add(tail.toLowerCase());
            out.add(depKey(tail));
        }
    }
    const readme = facts.docs.find((d) => isReadme(d.file));
    if (readme !== undefined) {
        const prose = facts.docs.filter((d) => d.file === readme.file && !/^(?:#|!\[|\[!\[|<|```|~~~|\||>)/.test(d.text) && words(d.text).length >= 3).slice(0, 3);
        for (const p of prose)
            add(p.text);
        if (prose.length > 0)
            sources.push(readme.file);
    }
    const entry = { words: out, sources: sources.join('; ') };
    OVERVIEW_WORDS.set(facts, entry);
    return entry;
}
export const projectOverview = (rule, facts) => {
    const pkg = facts.pkg;
    if (pkg === null || rule.kind !== 'paragraph' || rule.text.length > 4 * SHORT)
        return null;
    const name = pkg.name ?? '';
    const own = new Set([name.toLowerCase(), (name.split('/').pop() ?? name).toLowerCase()]);
    if (!spans(rule.text).every((s) => own.has(s.toLowerCase())))
        return null;
    const text = rule.text.replace(/`([^`\n]+)`/g, '$1');
    if (/\d|https?:|www\.|\]\(/.test(text) || NEGATION.test(text) || ABSOLUTE.test(text) || !LATIN.test(text))
        return null;
    const all = words(text);
    if (all.some((w) => IMPERATIVE.has(w) || TIMING.has(w) || CONDITION.has(w) || EFFECT.has(w) || STATE.has(w) || w === 'you' || w === 'your'))
        return null;
    const { words: vocab, sources } = overviewWords(facts);
    if (sources === '')
        return null;
    const covered = (w) => vocab.has(w) || vocab.has(stem(w));
    const content = all.filter((w) => !FUNCTION_WORDS.has(w));
    if (content.length < 6 || content.filter(covered).length < 0.8 * content.length)
        return null;
    // One sentence the README does not hold is new information, whatever the whole paragraph scores.
    for (const sentence of text.split(/[.!?:;]+(?:\s|$)/)) {
        if (words(sentence).filter((w) => !FUNCTION_WORDS.has(w) && !covered(w)).length >= 2)
            return null;
    }
    return answer('inferable-overview', sources);
};
export const q1 = (rule, facts) => inferableTitle(rule, facts) ?? inferableTree(rule, facts) ?? inferableScript(rule, facts) ?? inferableTech(rule, facts) ?? inferableOverview(rule, facts) ??
    describedPath(rule, facts) ?? stackList(rule, facts) ?? describedScript(rule, facts) ?? projectOverview(rule, facts);
