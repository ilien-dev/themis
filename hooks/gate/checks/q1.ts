import { closeSync, openSync, readSync } from 'node:fs';
import { join, relative } from 'node:path';
import { read } from '../../lib.ts';
import { isRecord, parseJsonc } from '../read-config.ts';
import {
  AFFIRM, GENERIC_SUBPATHS, NEGATION, OBVIOUS_SCRIPTS, SCRIPT_SYNONYMS, STACK_LABELS, STACK_NEUTRAL, STACK_VERB_LABELS, TECH, type Tech,
} from '../tables/alias.ts';
import { ABSOLUTE, citedPaths, citedScripts, hasReason, mentions, onlyConnectives, similarity, spans, words } from '../text.ts';
import { PM_COMMANDS, alive, clean } from './q7.ts';
import type { Facts } from '../facts.ts';
import type { Answer, Rule } from '../types.ts';
import type { Check } from '../verdict.ts';

// Question 1: does the repository already say what this rule says?

const WB_BEFORE = String.raw`(?<![\p{L}\p{N}_-])`;
const WB_AFTER = String.raw`(?![\p{L}\p{N}_-])`;
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
const SCRIPT_JOB: Readonly<Record<string, ReadonlySet<string>>> = {
  test: new Set(['test', 'tests', 'testing', 'suite', 'unit', 'pruebas']),
  lint: new Set(['lint', 'linter', 'linting']),
  build: new Set(['build', 'builds', 'compile', 'compila', 'compilar']),
  dev: new Set(['dev', 'development', 'server', 'desarrollo', 'servidor']),
  start: new Set(['start', 'starts', 'server', 'inicia', 'arranca', 'servidor']),
  format: new Set(['format', 'formatter', 'formatting', 'formatea', 'formato']),
  typecheck: new Set(['typecheck', 'types', 'type', 'check']),
};
const TIMING = new Set(['before', 'after', 'always', 'when', 'until', 'once', 'every', 'antes', 'después', 'siempre', 'cuando', 'hasta', 'cada']);

const escape =(s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const answer = (code: string, evidence: string): Answer => ({ verdict: 'cut', code, question: 1, evidence });
const isReadme = (file: string): boolean => file.split('/').pop() === 'README.md';

const MENTION = new Map<Tech, RegExp>(TECH.map((t) => [
  t, new RegExp(`${WB_BEFORE}(?:${[t.name, ...t.aliases].map(escape).join('|')})${WB_AFTER}`, 'gu'),
]));
const AFFIRM_G = AFFIRM.map((r) => new RegExp(r.source, r.flags.includes('g') ? r.flags : `${r.flags}g`));

const has = (text: string, re: RegExp): boolean => text.search(re) >= 0;

function inferableTitle(rule: Rule, facts: Facts): Answer | null {
  if (rule.kind !== 'heading') return null; // a paragraph says more than a title, wherever it sits
  const name = facts.pkg?.name;
  if (name !== null && name !== undefined && name !== '') {
    const last = name.split('/').pop() ?? name;
    if (mentions(rule.text, name) || mentions(rule.text, last)) {
      const own = new Set([...words(name), ...words(last)]);
      const others = words(rule.text).filter((w) => !own.has(w) && !FILLER.has(w));
      if (others.length === 0 && !ABSOLUTE.test(rule.text) && !NEGATION.test(rule.text)) return answer('inferable-title', `${facts.pkg?.path ?? 'package.json'}: name`);
    }
  }
  const readme = facts.docs.find((d) => isReadme(d.file));
  if (readme !== undefined && similarity(rule.text, readme.text) > 0.8) return answer('inferable-title', readme.file);
  return null;
}

// Existing files or directories, as paths without a trailing slash.
function pathExists(p: string, facts: Facts, dirs: () => ReadonlySet<string>): boolean {
  return facts.files.has(p) || dirs().has(p);
}

const instructs = (text: string): boolean => words(text).some((w) => IMPERATIVE.has(w)) || NEGATION.test(text) || ABSOLUTE.test(text);

// A drawn tree whose entries exist in the repository and carry no comment: a comment can hold a gotcha
// ("# to be removed", "# moved to lib"), and a plain description cannot be told apart from one.
function treeIsReal(text: string, facts: Facts): boolean {
  const names = new Set<string>();
  for (const f of facts.files) for (const seg of f.split('/')) names.add(seg);
  let hits = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('```') || line.startsWith('~~~')) continue;
    if (instructs(line)) return false;
    const body = line.replace(/^[\s│├└─|+\\`-]+/, '');
    const gap = body.search(/\s/);
    const entry = (gap < 0 ? body : body.slice(0, gap)).replace(/[/:]+$/, '');
    if (gap >= 0 && body.slice(gap).trim() !== '') return false;
    if (entry !== '' && names.has(entry)) hits++;
  }
  return hits >= 2;
}

function inferableTree(rule: Rule, facts: Facts): Answer | null {
  if (rule.kind === 'code') return (rule.text.includes('\u251c') || rule.text.includes('\u2514')) && treeIsReal(rule.text, facts) ? answer('inferable-tree', 'repository file tree') : null;
  if (rule.kind !== 'item' && rule.kind !== 'steps') return null;
  let dirSet: Set<string> | null = null;
  const dirs = (): ReadonlySet<string> => {
    if (dirSet === null) {
      dirSet = new Set();
      for (const f of facts.files) for (let i = f.indexOf('/'); i >= 0; i = f.indexOf('/', i + 1)) dirSet.add(f.slice(0, i));
    }
    return dirSet;
  };
  const found: string[] = [];
  for (const line of rule.text.split('\n')) {
    const body = LIST_ITEM.exec(line)?.[1]?.trim();
    if (body === undefined) continue;
    const cut = body.search(/\s/);
    if (cut < 0) continue;
    const path = body.slice(0, cut).replace(/^`|[`:,]+$/g, '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
    const rest = body.slice(cut).replace(/^[\s:\u2013\u2014-]+/, '');
    if (path === '' || words(rest).length === 0 || instructs(rest)) continue;
    if (pathExists(path, facts, dirs)) found.push(path);
  }
  return found.length >= 3 ? answer('inferable-tree', `paths: ${found.slice(0, 3).join(', ')}`) : null;
}

function inferableScript(rule: Rule, facts: Facts): Answer | null {
  const all = spans(rule.text);
  const span = all[0];
  if (all.length !== 1 || span === undefined || facts.pkg === null) return null;
  const m = /^(npm|pnpm|yarn|bun)\s+(run\s+)?([\w:.-]+)$/.exec(span.trim());
  const pm = m?.[1];
  const script = m?.[3];
  if (pm === undefined || script === undefined || !OBVIOUS_SCRIPTS.includes(script)) return null;
  if (m?.[2] === undefined && pm === 'npm' && script !== 'test' && script !== 'start') return null; // `npm lint` is not a command
  if (!Object.hasOwn(facts.pkg.scripts, script)) return null;
  const outside = rule.text.replace(LIST_MARKER, '').replace(`\`${span}\``, ' ');
  if (/[\d/\\_`@$=<>]|\w\.\w/.test(outside)) return null; // a number, a path or an identifier is information
  const around = words(outside);
  const job = SCRIPT_JOB[script];
  if (around.length > 4 || !around.every((w) => SCRIPT_NEUTRAL.has(w) || job?.has(w) === true)) return null;
  if (around.some((w) => TIMING.has(w)) || ABSOLUTE.test(outside) || NEGATION.test(outside)) return null;
  return answer('inferable-script', `${facts.pkg.path}: scripts.${script}`);
}

// Which dependency group of package.json holds `name`.
function depGroup(facts: Facts, name: string): string {
  const text = facts.pkg === null ? null : read(join(facts.root, facts.pkg.path));
  const parsed = text === null ? null : parseJsonc(text);
  if (isRecord(parsed)) {
    for (const g of DEP_GROUPS) {
      const group = parsed[g];
      if (isRecord(group) && Object.hasOwn(group, name)) return g;
    }
  }
  return 'dependencies';
}

// The evidence that the repository uses `t`, or null when it does not.
function presence(t: Tech, facts: Facts): string | null {
  if (t.category === 'language') {
    const lang = t.language ?? t.name;
    return facts.languages[0] === lang ? `file listing: ${lang}` : null; // only the leading language is "the" language
  }
  const pkg = t.packages?.find((p) => facts.pkg?.deps.has(p));
  if (pkg !== undefined && facts.pkg !== null) return `${facts.pkg.path}: ${depGroup(facts, pkg)}.${pkg}`;
  if (t.lockfile !== undefined && facts.lockfiles.has(t.lockfile)) return t.lockfile;
  if (t.language !== undefined && facts.languages.includes(t.language)) return `file listing: ${t.language}`;
  return null;
}

function inferableTech(rule: Rule, facts: Facts): Answer | null {
  if (rule.kind === 'code') return null;
  const text = rule.text;
  if (!AFFIRM.some((r) => r.test(text)) || NEGATION.test(text)) return null;
  // Inside a code span a name counts whatever its case: capitalise it so the table's spellings match.
  const plain = text.replace(/`([^`\n]+)`/g, (_, s: string) => s.charAt(0).toUpperCase() + s.slice(1));
  const mentioned = TECH.filter((t) => has(plain, MENTION.get(t) ?? /$^/u));
  if (mentioned.length === 0) return null;

  const present = new Map<Tech, string>();
  for (const t of TECH) {
    const e = presence(t, facts);
    if (e !== null) present.set(t, e);
  }
  const evidence: string[] = [];
  for (const t of mentioned) {
    const e = present.get(t);
    if (e === undefined || t.replacesDefault === true) return null;
    if ([...present.keys()].some((o) => o !== t && o.category === t.category)) return null;
    evidence.push(e);
  }

  let rest = plain;
  for (const r of AFFIRM_G) rest = rest.replace(r, ' ');
  for (const t of mentioned) rest = rest.replace(MENTION.get(t) ?? /$^/u, ' ');
  return onlyConnectives(rest, STOPWORDS) ? answer('inferable-tech', evidence.join('; ')) : null;
}

function inferableOverview(rule: Rule, facts: Facts): Answer | null {
  if (rule.kind !== 'paragraph') return null;
  if (spans(rule.text).length > 0 || citedPaths(rule.text).length > 0) return null;
  if (rule.text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim() !== '').length < 2) return null;
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
  'truth', 'canonical', 'authoritative', 'canónico', 'canónica', 'verdad', // "single source of truth": edit here and nowhere else
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
const SEPARATOR =/^\s*(?:[:–—]|-{1,2}(?=\s))\s*/;

const stem = (w: string): string => (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

// Is `text` a plain description of up to 25 words: nothing a reader must act on, beware of or check?
// `allowedSpan` decides each code span; a span it refuses makes the text more than a description.
function plainDescription(text: string, allowedSpan: (s: string) => boolean): boolean {
  if (!LATIN.test(text) || /\d|https?:|www\./.test(text) || NEGATION.test(text) || ABSOLUTE.test(text)) return false;
  if (!spans(text).every(allowedSpan)) return false;
  const bare = text.replace(/`[^`\n]*`/g, ' ');
  // A second sentence or a clause after ";" or a dash is a remark about the thing, not its description.
  if (/[.!?](?:\s+\S)/.test(bare.replace(/\b(?:e\.g|i\.e|etc|vs)\./gi, '')) || hasReason(bare) || /\s-{1,2}\s/.test(bare)) return false;
  const w = words(bare);
  if (w.length === 0 || w.length > 25) return false;
  // "for changing refund logic", "para cambiar…": the form of a trigger ("read it when…"), not of a description.
  if (w[0] === 'for' || w[0] === 'para') return false;
  const verb = (x: string): boolean => IMPERATIVE.has(x) || EFFECT.has(x);
  const gerund = (x: string): boolean => x !== 'using' && x.endsWith('ing') && (verb(x.slice(0, -3)) || verb(`${x.slice(0, -3)}e`) || verb(x.slice(0, -4)));
  return !w.some((x) => IMPERATIVE.has(x) || gerund(x) || TIMING.has(x) || CONDITION.has(x) || STATE.has(x) || EFFECT.has(x) || PRONOUN.has(x) || QUANTIFIER.has(x));
}

// The path a token names, or null when it does not look like one.
function pathToken(raw: string): string | null {
  const p = clean(raw.trim().replace(/^\/+/, ''));
  if (p === '' || /[\s*?{}<>[\]]/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('..') || p.startsWith('~')) return null;
  return PATH_SHAPE.test(p) || raw.includes('/') ? p : null;
}

const exists = (p: string, facts: Facts): boolean => facts.inRepo && facts.filesKnown && alive(p, facts);

// ---- What a described path may say: the words of the path, of the file it names, or of the files under it ----

// Lowercase, one light suffix off (-ing, -ed, -es, -s) and a final e, so "parses", "parse" and "parsing" meet.
function norm(w: string): string {
  let x = w;
  for (const s of ['ing', 'ed', 'es', 's']) if (x.endsWith(s) && x.length - s.length >= 3) { x = x.slice(0, -s.length); break; }
  return x.length >= 4 && x.endsWith('e') ? x.slice(0, -1) : x;
}
// The words of code or prose: identifiers split on camelCase, snake_case and kebab-case. Linear.
const identWords = (text: string): string[] =>
  words(text.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/_/g, ' ')).map(norm);

const PATH_NEUTRAL: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'with', 'via', 'used', 'using', 'that', 'which', 'to', 'in', 'on', 'by', 'from', 'into', 'as', 'at',
  'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'de', 'del', 'con', 'en', 'para', 'por', 'que', 'al', 'mediante',
].map(norm));
// Role nouns: what kind of thing a file or folder is, which says nothing the listing does not.
const ROLE_NOUNS: ReadonlySet<string> = new Set([
  'helpers', 'helper', 'utilities', 'utility', 'utils', 'components', 'component', 'tests', 'test', 'config', 'configuration', 'types', 'type',
  'constants', 'hooks', 'routes', 'route', 'handlers', 'handler', 'models', 'model', 'services', 'service', 'scripts', 'script', 'styles',
  'assets', 'docs', 'documentation', 'entry', 'point', 'main', 'module', 'modules', 'wrapper', 'client', 'server', 'api', 'logic', 'code',
  'functions', 'function', 'definitions', 'schema', 'pages', 'page', 'views', 'layout', 'store', 'state', 'middleware',
  'utilidades', 'ayudantes', 'componentes', 'pruebas', 'configuración', 'tipos', 'constantes', 'rutas', 'manejadores', 'modelos',
  'servicios', 'estilos', 'recursos', 'documentación', 'entrada', 'punto', 'principal', 'módulo', 'módulos', 'cliente', 'servidor',
  'lógica', 'código', 'funciones', 'función', 'definiciones', 'esquema', 'páginas', 'página', 'vistas', 'estado',
].map(norm));

const posix = (p: string): string => p.replaceAll('\\', '/');
type Target ={ readonly kind: 'file'; readonly file: string } | { readonly kind: 'dir'; readonly files: readonly string[] };
const MAX_DIR_ENTRIES = 500;

// The one tracked file a path names, or the files under the directory it names; null when it is ambiguous
// (two files end with it) or not in the listing.
function targetOf(p: string, facts: Facts): Target | null {
  const fromDir = posix(relative(facts.root, join(facts.dir, p)));
  let file: string | null = null;
  let many = false;
  const under: string[] = [];
  for (const f of facts.files) {
    if (f === p || f === fromDir || f.endsWith(`/${p}`)) { if (file !== null && file !== f) many = true; file = f; continue; }
    const inner = f.indexOf(`/${p}/`);
    const i = f.startsWith(`${p}/`) ? p.length + 1 : inner < 0 ? -1 : inner + p.length + 2;
    if (i >= 0 && under.length < MAX_DIR_ENTRIES) under.push(f.slice(i));
  }
  if (file !== null) return many ? null : { kind: 'file', file };
  return under.length === 0 ? null : { kind: 'dir', files: under };
}

function dirWords(files: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const f of files) for (const w of identWords(f)) out.add(w);
  return out;
}

// The words and identifiers of a file's first 64 KB, read once per Facts, within 2 MB per Facts. Null when
// the file is missing on disk, unreadable or binary, or the budget is spent.
const HEAD_BYTES = 64 * 1024;
const READ_BUDGET = 2 * 1024 * 1024;
interface FileWords { readonly words: ReadonlySet<string>; readonly identifiers: ReadonlySet<string> }
const READS = new WeakMap<Facts, { used: number; files: Map<string, FileWords | null> }>();
function fileWords(file: string, facts: Facts): FileWords | null {
  let state = READS.get(facts);
  if (state === undefined) { state = { used: 0, files: new Map() }; READS.set(facts, state); }
  const known = state.files.get(file);
  if (known !== undefined) return known;
  if (state.used >= READ_BUDGET) return null; // not cached: the budget belongs to this run, not to the file
  let result: FileWords | null = null;
  let fd: number | null = null;
  try {
    fd = openSync(join(facts.root, file), 'r');
    const buf = Buffer.alloc(Math.min(HEAD_BYTES, READ_BUDGET - state.used));
    const n = readSync(fd, buf, 0, buf.length, 0);
    state.used += n;
    const head = buf.subarray(0, n);
    if (!head.includes(0)) {
      const text = head.toString('utf8');
      result = { words: new Set(identWords(text)), identifiers: new Set(text.match(/[A-Za-z_$][\w$]*/g) ?? []) };
    }
  } catch {
    result = null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
  state.files.set(file, result);
  return result;
}

// "- `lib/nvidia.js` — Executes nvidia-smi", "- **Cache** (lib/cache.js:5): In-memory LRU cache".
const PATH_FIRST = /^(?:\*\*`([^`\n]{1,200})`\*\*|`([^`\n]{1,200})`|\*\*([^*`\n]{1,200}?):?\*\*|([^\s`*():]{1,200}))/;
const NAME_THEN_PATH = /^(\*\*[^*\n]{1,60}\*\*|`[^`\n]{1,60}`|[\p{L}][\p{L}\p{N} _-]{0,40}?)\s*\(\s*`?([^()`\s]{1,200})`?\s*\)/u;

export const describedPath: Check = (rule, facts) => {
  if (rule.kind !== 'item' || rule.lines !== 1 || rule.text.length > SHORT) return null;
  const body = rule.text.replace(LIST_MARKER, '').trim();
  let path: string | null;
  let name = '';
  let rest: string;
  const named = NAME_THEN_PATH.exec(body);
  if (named !== null) {
    path = pathToken(named[2] ?? '');
    name = (named[1] ?? '').replace(/[*`]/g, '');
    rest = body.slice(named[0].length);
  } else {
    const m = PATH_FIRST.exec(body);
    if (m === null) return null;
    path = pathToken(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    rest = body.slice(m[0].length);
  }
  const sep = SEPARATOR.exec(rest);
  if (path === null || sep === null) return null;
  const description = rest.slice(sep[0].length);
  // The blacklists stay as a guard; the whitelist below decides.
  if (name !== '' && !plainDescription(name, () => false)) return null;
  if (!plainDescription(description, () => true) || !toolsAreDeps(description, facts)) return null;
  if (!exists(path, facts)) return null;
  const target = targetOf(path, facts);
  if (target === null) return null;
  const known = target.kind === 'file' ? fileWords(target.file, facts) : { words: dirWords(target.files), identifiers: new Set<string>() };
  if (known === null) return null; // missing on disk, unreadable, binary, or past the read budget
  // A span counts only as a plain identifier the file itself holds; any other span is more than a description.
  if (!spans(description).every((s) => /^[A-Za-z_$][\w$]*$/.test(s) && known.identifiers.has(s))) return null;
  const own = new Set(identWords(path));
  let matched = 0;
  for (const w of identWords(`${name} ${description.replace(/`[^`\n]*`/g, ' ')}`)) {
    if (own.has(w) || known.words.has(w)) matched++;
    else if (!PATH_NEUTRAL.has(w) && !ROLE_NOUNS.has(w)) return null; // a word the repository does not hold is information
  }
  return matched >= 2 ? answer('inferable-path', `path: ${path}`) : null;
};

// The dependencies of the manifest by the keys a rule may write them with. Computed once per Facts.
interface DepIndex { readonly full: ReadonlyMap<string, string>; readonly last: ReadonlyMap<string, string> }
const DEP_INDEX = new WeakMap<Facts, DepIndex>();
const depKey = (s: string): string => s.toLowerCase().replace(/(?:\.?js)$/, (m) => (s.length - m.length >= 2 ? '' : m)).replace(/[\s._/@-]+/g, '');

function depIndex(facts: Facts): DepIndex {
  const cached = DEP_INDEX.get(facts);
  if (cached !== undefined) return cached;
  const full = new Map<string, string>();
  const last = new Map<string, string>();
  for (const d of facts.pkg?.deps ?? []) {
    if (d.startsWith('@types/')) continue; // typings say nothing of the runtime or its version
    const k = depKey(d);
    if (!full.has(k)) full.set(k, d);
    const tail = d.startsWith('@') ? d.split('/')[1] : undefined;
    if (tail !== undefined && !GENERIC_SUBPATHS.has(tail.toLowerCase())) { const t = depKey(tail); if (!last.has(t)) last.set(t, d); }
  }
  const index = { full, last };
  DEP_INDEX.set(facts, index);
  return index;
}

const TECH_BY_SPELLING = new Map<string, Tech>(TECH.flatMap((t) => [t.name, ...t.aliases].map((n) => [n, t] as const)));

// The dependency a written name stands for, or null.
function resolveDep(name: string, facts: Facts): string | null {
  const tech = TECH_BY_SPELLING.get(name);
  if (tech?.replacesDefault === true) return null;
  const { full, last } = depIndex(facts);
  const k = depKey(name);
  const hit = full.get(k) ?? last.get(k);
  if (hit !== undefined) return hit;
  return tech?.packages?.find((p) => !p.startsWith('@types/') && facts.pkg?.deps.has(p) === true) ?? null;
}

// Is another technology of the same kind in the manifest? Then naming one of them ("Testing: Jest" next to
// vitest) says which is used for what, as question 1 already assumes for "use X".
// A rival the rule names too ("Next.js · React") is no choice between them.
function rivalPresent(dep: string, facts: Facts, named: ReadonlySet<string> = new Set()): boolean {
  const own = TECH.find((t) => t.packages?.includes(dep) === true);
  if (own === undefined) return false;
  return TECH.some((t) => t !== own && t.category === own.category && t.packages?.some((p) => facts.pkg?.deps.has(p) === true) === true &&
    !t.packages.some((p) => named.has(p)));
}

// "MCP server using fastmcp": the tool a description names after "using" or "via" must be a dependency, or
// the description may be stale (the manifest lists another one) and is not the repository's to repeat.
const TOOL_SLOT = /(?<![\p{L}\p{N}_-])(?:using|via|powered\s+by|built\s+(?:on|with)|mediante|usando)\s+(?:(?:the|a|an|el|la)\s+)?([\p{L}@][\p{L}\p{N}@/._-]{0,60})/giu;
function toolsAreDeps(text: string, facts: Facts): boolean {
  for (const m of text.matchAll(TOOL_SLOT)) {
    const tool = (m[1] ?? '').replace(/[.]+$/, '');
    if (resolveDep(tool, facts) === null) return false;
  }
  return true;
}

// The major and minor version of a plain range ("^19.0.0", "~5.7", "18.x"), or null when the range is anything else.
function versionOf(range: string): { major: number; minor: number | null } | null {
  const m = /^[\^~]?v?(\d+)(?:\.(\d+|x|\*))?(?:\.(?:\d+|x|\*))?$/.exec(range.trim());
  if (m?.[1] === undefined) return null;
  const minor = m[2] === undefined || !/^\d+$/.test(m[2]) ? null : Number(m[2]);
  return { major: Number(m[1]), minor };
}

// Does the version a rule gives match the manifest's? Null when it cannot tell: below 1.0 a minor is a
// major, so "0.x" claims are compared by minor and abstain without one.
function sameVersion(seg: Segment, range: string): boolean | null {
  const v = versionOf(range);
  if (v === null || seg.major === null) return null;
  if (v.major === 0 || seg.major === 0) {
    if (v.minor === null || seg.minor === null) return null;
    if (v.major !== seg.major) return false;
    return seg.orLater ? v.minor >= seg.minor : v.minor === seg.minor;
  }
  return seg.orLater ? v.major >= seg.major : v.major === seg.major;
}

const LABEL = /^(?:\*\*([^*\n]{1,40}?):?\*\*:?|([\p{L}][\p{L} ]{0,30}?):)\s*/u;
// Linear enough only because a stack line is at most SHORT (600) characters: the leading \s+ backtracks
// over a run of spaces. Do not use it on longer text.
const VERSION = /\s+v?(\d+)(?:\.(\d+|x))?(?:\.(?:\d+|x))*(\uE003)?$/;
interface Segment { readonly dep: string; readonly unambiguous: boolean; readonly major: number | null; readonly minor: number | null; readonly orLater: boolean; readonly text: string }

// One segment of a stack list, or null when it is anything but a dependency with an optional version,
// neutral role words and a parenthesis of neutral words or other dependencies.
function segment(raw: string, held: readonly string[], restore: (x: string) => string, facts: Facts): Segment | null {
  let s = raw.trim().replace(/[.]+$/, '');
  for (const m of s.matchAll(/\uE001(\d+)\uE001/g)) {
    const inner = restore(held[Number(m[1])] ?? '');
    const parts = inner.split(/\s*(?:,|\+|\/|\band\b)\s*/);
    if (!parts.every((p) => words(p).every((w) => STACK_NEUTRAL.has(w)) || resolveDep(p.replace(/[`*]/g, '').trim(), facts) !== null)) return null;
  }
  s = s.replace(/\s*\uE001\d+\uE001\s*/g, ' ').trim();
  const backticked = /^`.*`$/.test(s.replace(/^\*\*|\*\*$/g, ''));
  s = s.replace(/^\*\*|\*\*$/g, '').replace(/^`|`$/g, '').trim();
  const stripRoles = (x: string): string => {
    let out = x;
    for (let w = /\s+([\p{L}-]+)$/u.exec(out); w !== null && words(w[1] ?? '').every((y) => STACK_NEUTRAL.has(y)); w = /\s+([\p{L}-]+)$/u.exec(out)) {
      if (resolveDep(out, facts) !== null) break;
      out = out.slice(0, w.index);
    }
    return out;
  };
  s = stripRoles(s);
  const v = VERSION.exec(s);
  if (v !== null) s = stripRoles(s.slice(0, v.index));
  const dep = s === '' ? null : resolveDep(s, facts); // a digit left in the name must belong to a dependency's name
  if (dep === null) return null;
  // Unambiguous: in backticks, a name no ordinary word has (a dot, a dash, a digit, a scope, two words), or a
  // spelling of the technology table. A capital alone is not a mark: every line and segment may start with one.
  const unambiguous = backticked || /[^\p{L}]/u.test(s) || TECH_BY_SPELLING.has(s);
  return { dep, unambiguous, major: v === null ? null : Number(v[1]),
    minor: v?.[2] === undefined || v[2] === 'x' ? null : Number(v[2]), orLater: v?.[3] !== undefined, text: raw.trim() };
}

export const stackList: Check = (rule, facts) => {
  const pkg = facts.pkg;
  if (pkg === null || pkg.deps.size === 0 || rule.lines !== 1 || rule.text.length > SHORT || (rule.kind !== 'item' && rule.kind !== 'paragraph')) return null;
  const text = rule.text.replace(LIST_MARKER, '').trim();
  if (NEGATION.test(text) || ABSOLUTE.test(text) || !LATIN.test(text)) return null;

  // "**dependency**: description" is not a list: nothing in the repository can check the description
  // ("**lodash**: being phased out"), so it is kept whatever it says.
  // A list, after an optional label from the closed list.
  let list = text;
  let labelled = false;
  const verb = STACK_VERB_LABELS.find((l) => list.toLowerCase().startsWith(`${l} `) || list.toLowerCase().startsWith(`${l}:`));
  if (verb !== undefined) { list = list.slice(verb.length).replace(/^\s*:?\s*/, ''); labelled = true; } else {
    const l = LABEL.exec(list);
    if (l !== null) {
      if (!STACK_LABELS.has((l[1] ?? l[2] ?? '').trim().toLowerCase())) return null; // an unknown label says something
      list = list.slice(l[0].length);
      labelled = true;
    }
  }
  if (!labelled && rule.kind !== 'item') return null; // in a paragraph, "debug and colors" is prose

  const held: string[] = [];
  const hold = (re: RegExp, mark: string, x: string): string => x.replace(re, (m) => { held.push(m); return `${mark}${held.length - 1}${mark}`; });
  list = hold(/`[^`\n]+`/g, '\uE002', list);
  list = hold(/@[\w.-]+\/[\w.-]+/g, '\uE002', list);
  list = list.replace(/\(([^()\n]{0,120})\)/g, (_, inner: string) => { held.push(inner); return `\uE001${held.length - 1}\uE001`; });
  if (/[()]/.test(list)) return null;
  list = list.replace(/(\d)\+/g, '$1\uE003');
  const raw = list.split(/\s*(?:,|·|\||\+|\/|&|(?<![\p{L}])(?:and|y)(?![\p{L}]))\s*/u).filter((x) => x.trim() !== '');
  if (raw.length < 2 || raw.length > 15) return null; // one segment is a choice ("HTTP: Axios"), not a list
  const restore = (x: string): string => x.replace(/\uE002(\d+)\uE002/g, (_, i: string) => held[Number(i)] ?? '');
  const segs: Segment[] = [];
  for (const r of raw) {
    const seg = segment(restore(r), held, restore, facts);
    if (seg === null) return null;
    segs.push(seg);
  }
  const named = new Set(segs.map((x) => x.dep));
  if (segs.some((x) => rivalPresent(x.dep, facts, named))) return null;
  // A dependency named by an ordinary word ("debug", "colors") counts only in backticks, or when every
  // other segment is unambiguous: a capital at the start of a line or segment earns it nothing.
  for (const seg of segs) {
    if (!seg.unambiguous && (segs.length < 2 || segs.some((o) => o !== seg && !o.unambiguous))) return null;
  }

  let stale: Segment | null = null;
  for (const seg of segs) {
    if (seg.major === null) continue;
    const ranges = [...new Set((pkg.versions[seg.dep] ?? []).map((x) => x.trim()))];
    const range = ranges[0];
    // One range across the groups, and one major in the rule: anything else the manifest cannot settle.
    if (ranges.length !== 1 || range === undefined) return null;
    if (segs.some((o) => o.dep === seg.dep && o.major !== null && o.major !== seg.major)) return null;
    const same = sameVersion(seg, range);
    if (same === null) return null; // a version the manifest cannot confirm is information
    if (!same) {
      if (seg.major < 1 || !/^[\^~]?\d+(?:\.\d+){0,2}$/.test(range) || (versionOf(range)?.major ?? 0) < 1) return null;
      stale ??= seg;
    }
  }
  if (stale !== null) {
    const range = (pkg.versions[stale.dep] ?? [])[0] ?? '';
    return { verdict: 'conflict', code: 'stale-version', question: 1, evidence: `${pkg.path}: ${depGroup(facts, stale.dep)}.${stale.dep} is ${range}; the rule says "${stale.text}"` };
  }
  return answer('inferable-stack', `${pkg.path}: ${[...new Set(segs.map((x) => `${depGroup(facts, x.dep)}.${x.dep}`))].join(', ')}`);
};

// The words a script may be described with: its name's parts, its command's words, and their synonyms.
const SYNONYMS = new Map<string, readonly string[]>(SCRIPT_SYNONYMS.flatMap((g) => g.map((w) => [w, g] as const)));
function scriptWords(name: string, command: string): Set<string> {
  const own = new Set<string>();
  for (const w of [...words(name.replace(/[:._-]/g, ' ')), ...words(command).filter((x) => x.length >= 3 && !COMMAND_NOISE.has(x))]) {
    for (const v of [w, stem(w)]) { own.add(v); for (const syn of SYNONYMS.get(v) ?? []) own.add(syn); }
  }
  return own;
}

export const describedScript: Check = (rule, facts) => {
  const pkg = facts.pkg;
  if (pkg === null || rule.lines !== 1 || rule.text.length > SHORT || (rule.kind !== 'item' && rule.kind !== 'paragraph')) return null;
  const all = spans(rule.text);
  const span = all[0];
  if (all.length !== 1 || span === undefined) return null;
  const m = /^(npm|pnpm|yarn|bun)\s+(run\s+)?([\w:.-]+)$/.exec(span.trim());
  const cited = citedScripts(`\`${span}\``)[0];
  const script = m?.[3];
  if (m === null || cited === undefined || script === undefined || !Object.hasOwn(pkg.scripts, script)) return null;
  // With other package.json files in the tree a script of the same name may be theirs, as question 7 assumes.
  if ([...facts.files].some((f) => (f === 'package.json' || f.endsWith('/package.json')) && f !== pkg.path)) return null;
  if (!cited.explicit && (cited.pm === 'npm' ? script !== 'test' && script !== 'start' : PM_COMMANDS.has(script))) return null;
  const command = pkg.scripts[script] ?? '';
  const outside = rule.text.replace(LIST_MARKER, '').replace(`\`${span}\``, ' ').replace(SEPARATOR, '').trim();
  if (/[\d/\\_`@$=<>]|\w\.\w/.test(outside) || hasReason(outside) || NEGATION.test(outside) || ABSOLUTE.test(outside) || !LATIN.test(outside)) return null;
  const around = words(outside);
  const own = scriptWords(script, command);
  if (around.length > 12 || [...words(script.replace(/[:._-]/g, ' ')), ...words(command), ...around].some((w) => RISKY.has(w))) return null;
  if (around.some((w) => TIMING.has(w) || CONDITION.has(w) || EFFECT.has(w) || STATE.has(w) || PRONOUN.has(w))) return null;
  const known = (w: string): boolean => SCRIPT_NEUTRAL.has(w) || SCRIPT_VERBS.has(w) || own.has(w) || own.has(stem(w));
  return around.every(known) ? answer('inferable-script', `${pkg.path}: scripts.${script}`) : null;
};

// The words an overview may be made of: the manifest's description and name, the first three prose
// paragraphs of the README, and the dependency names. Computed once per Facts.
const OVERVIEW_WORDS = new WeakMap<Facts, { words: ReadonlySet<string>; sources: string }>();
function overviewWords(facts: Facts): { words: ReadonlySet<string>; sources: string } {
  const cached = OVERVIEW_WORDS.get(facts);
  if (cached !== undefined) return cached;
  const out = new Set<string>();
  const add = (text: string): void => { for (const w of words(text)) { out.add(w); out.add(stem(w)); } };
  const sources: string[] = [];
  const pkg = facts.pkg;
  if (pkg !== null) {
    add(pkg.name ?? '');
    if (pkg.description !== null) { add(pkg.description); sources.push(`${pkg.path}: description`); }
    for (const d of pkg.deps) { const tail = d.split('/').pop() ?? d; out.add(d.toLowerCase()); out.add(tail.toLowerCase()); out.add(depKey(tail)); }
  }
  const readme = facts.docs.find((d) => isReadme(d.file));
  if (readme !== undefined) {
    const prose = facts.docs.filter((d) => d.file === readme.file && !/^(?:#|!\[|\[!\[|<|```|~~~|\||>)/.test(d.text) && words(d.text).length >= 3).slice(0, 3);
    for (const p of prose) add(p.text);
    if (prose.length > 0) sources.push(readme.file);
  }
  const entry = { words: out, sources: sources.join('; ') };
  OVERVIEW_WORDS.set(facts, entry);
  return entry;
}

export const projectOverview: Check = (rule, facts) => {
  const pkg = facts.pkg;
  if (pkg === null || rule.kind !== 'paragraph' || rule.text.length > 4 * SHORT) return null;
  const name = pkg.name ?? '';
  const own = new Set([name.toLowerCase(), (name.split('/').pop() ?? name).toLowerCase()]);
  if (!spans(rule.text).every((s) => own.has(s.toLowerCase()))) return null;
  const text = rule.text.replace(/`([^`\n]+)`/g, '$1');
  if (/\d|https?:|www\.|\]\(/.test(text) || NEGATION.test(text) || ABSOLUTE.test(text) || !LATIN.test(text)) return null;
  const all = words(text);
  if (all.some((w) => IMPERATIVE.has(w) || TIMING.has(w) || CONDITION.has(w) || EFFECT.has(w) || STATE.has(w) || w === 'you' || w === 'your')) return null;
  const { words: vocab, sources } = overviewWords(facts);
  if (sources === '') return null;
  const covered = (w: string): boolean => vocab.has(w) || vocab.has(stem(w));
  const content = all.filter((w) => !FUNCTION_WORDS.has(w));
  // Every content word must come from the sources: one new word ("Columns are fixed.", "…in Stripe") is a
  // new fact, however well the rest of the paragraph scores.
  if (content.length < 6 || !content.every(covered)) return null;
  return answer('inferable-overview', sources);
};

export const q1: Check = (rule, facts) =>
  inferableTitle(rule, facts) ?? inferableTree(rule, facts) ?? inferableScript(rule, facts) ?? inferableTech(rule, facts) ?? inferableOverview(rule, facts) ??
  describedPath(rule, facts) ?? stackList(rule, facts) ?? describedScript(rule, facts) ?? projectOverview(rule, facts);
