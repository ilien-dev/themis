import { join } from 'node:path';
import { read } from '../../lib.ts';
import { isRecord, parseJsonc } from '../read-config.ts';
import { AFFIRM, NEGATION, OBVIOUS_SCRIPTS, TECH, type Tech } from '../tables/alias.ts';
import { ABSOLUTE, citedPaths, mentions, similarity, spans, words } from '../text.ts';
import type { Facts } from '../facts.ts';
import type { Answer, Rule } from '../types.ts';
import type { Check } from '../verdict.ts';

// Question 1: does the repository already say what this rule says?

const WB_BEFORE = String.raw`(?<![\p{L}\p{N}_-])`;
const WB_AFTER = String.raw`(?![\p{L}\p{N}_-])`;
const DEP_GROUPS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
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
  'project', 'instructions', 'guide', 'guidelines', 'claude', 'agents', 'for', 'the', 'repo', 'repository',
  'proyecto', 'instrucciones', 'guía', 'guia', 'guías', 'para', 'el', 'la', 'de', 'repositorio',
]);
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
  if (rule.kind !== 'heading' && !(rule.kind === 'paragraph' && rule.line === 1)) return null;
  const name = facts.pkg?.name;
  if (name !== null && name !== undefined && name !== '') {
    const last = name.split('/').pop() ?? name;
    if (mentions(rule.text, name) || mentions(rule.text, last)) {
      const own = new Set([...words(name), ...words(last)]);
      const others = words(rule.text).filter((w) => !own.has(w) && !FILLER.has(w));
      if (others.length <= 4 && !ABSOLUTE.test(rule.text) && !NEGATION.test(rule.text)) return answer('inferable-title', `${facts.pkg?.path ?? 'package.json'}: name`);
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

// A drawn tree whose entries exist in the repository and that carries no instruction.
function treeIsReal(text: string, facts: Facts): boolean {
  const names = new Set<string>();
  for (const f of facts.files) for (const seg of f.split('/')) names.add(seg);
  let hits = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('```') || line.startsWith('~~~')) continue;
    if (instructs(line)) return false;
    const entry = line.replace(/^[\s│├└─|+\\`-]+/, '').split(/\s/)[0]?.replace(/[/:]+$/, '') ?? '';
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
  const outside = rule.text.replace(`\`${span}\``, ' ');
  const around = words(outside);
  if (around.length > 4 || around.some((w) => TIMING.has(w)) || ABSOLUTE.test(outside) || NEGATION.test(outside)) return null;
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
  return !/\d/.test(rest) && words(rest).every((w) => STOPWORDS.has(w)) ? answer('inferable-tech', evidence.join('; ')) : null;
}

function inferableOverview(rule: Rule, facts: Facts): Answer | null {
  if (rule.kind !== 'paragraph') return null;
  if (spans(rule.text).length > 0 || citedPaths(rule.text).length > 0) return null;
  if (rule.text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim() !== '').length < 2) return null;
  const doc = facts.docs.find((d) => isReadme(d.file) && similarity(rule.text, d.text) > 0.8);
  return doc === undefined ? null : answer('inferable-overview', doc.file);
}

export const q1: Check = (rule, facts) =>
  inferableTitle(rule, facts) ?? inferableTree(rule, facts) ?? inferableScript(rule, facts) ?? inferableTech(rule, facts) ?? inferableOverview(rule, facts);
