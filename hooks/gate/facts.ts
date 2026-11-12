import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { gitLines, read } from '../lib.ts';
import { isRecord, parseEditorconfig, parseFlatYaml, parseJsonc } from './read-config.ts';

export type Tool = 'prettier' | 'eslint' | 'biome' | 'tsc' | 'editorconfig' | 'commitlint';

export interface Facts {
  readonly root: string;
  readonly dir: string;
  readonly inRepo: boolean;
  readonly pkg: {
    readonly path: string;
    readonly name: string | null;
    readonly description: string | null;
    readonly deps: ReadonlySet<string>;
    readonly versions: Readonly<Record<string, string>>; // the range of each dependency, the first group naming it winning
    readonly scripts: Readonly<Record<string, string>>;
  } | null;
  readonly lockfiles: ReadonlySet<string>;
  readonly config: ReadonlyMap<string, unknown>;
  readonly unreadable: readonly string[];
  readonly runs: ReadonlySet<Tool>;
  readonly deny: readonly string[];
  readonly files: ReadonlySet<string>;
  readonly filesKnown: boolean; // false when git failed in a repo: an empty `files` then means nothing
  readonly languages: readonly string[];
  readonly docs: readonly { readonly file: string; readonly text: string }[];
}

const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'uv.lock', 'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'Gemfile.lock', 'composer.lock'];
const LANGUAGES: Readonly<Record<string, string>> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.go': 'Go', '.rs': 'Rust',
};
const CODE_EXT = ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts'];
const TOOL_WORDS: readonly Tool[] = ['prettier', 'eslint', 'biome', 'tsc', 'commitlint'];

const posix = (p: string): string => p.split('\\').join('/');
const real = (p: string): string => { try { return realpathSync.native(p); } catch { return resolve(p); } };

// One tool's config: the readable files in order of precedence, the ones that need code to run, and
// the package.json key that can hold it.
interface ToolDef {
  readonly prefix: string;
  readonly files: readonly string[];
  readonly parse: (text: string) => Record<string, unknown> | null;
  readonly code: readonly string[];
  readonly pkgKey?: string;
}

const json = (text: string): Record<string, unknown> | null => { const v = parseJsonc(text); return isRecord(v) ? v : null; };
const jsonOrYaml = (text: string): Record<string, unknown> | null => (text.trimStart().startsWith('{') ? json(text) : parseFlatYaml(text));

const TOOLS: readonly ToolDef[] = [
  { prefix: 'prettier', files: ['.prettierrc', '.prettierrc.json', '.prettierrc.yaml', '.prettierrc.yml'], parse: jsonOrYaml, pkgKey: 'prettier',
    code: ['.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', ...CODE_EXT.map((e) => `prettier.config.${e}`), ...CODE_EXT.map((e) => `.prettierrc.${e}`)] },
  { prefix: 'eslint', files: ['.eslintrc.json', '.eslintrc'], parse: json, pkgKey: 'eslintConfig',
    code: ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml', ...CODE_EXT.map((e) => `eslint.config.${e}`)] },
  { prefix: 'biome', files: ['biome.json', 'biome.jsonc'], parse: json, code: [] },
  { prefix: 'commitlint', files: ['.commitlintrc', '.commitlintrc.json', 'commitlint.config.json'], parse: json, pkgKey: 'commitlint',
    code: ['.commitlintrc.yaml', '.commitlintrc.yml', ...CODE_EXT.map((e) => `commitlint.config.${e}`), ...CODE_EXT.map((e) => `.commitlintrc.${e}`)] },
];

// "prettier.semi", "eslint.rules.quotes"; with `deep` every nested key becomes a dotted path.
function flatten(prefix: string, v: unknown, out: Map<string, unknown>, deep: boolean): void {
  if (!isRecord(v)) { out.set(prefix, v); return; }
  for (const [k, x] of Object.entries(v)) {
    if (deep || (k === 'rules' && isRecord(x))) flatten(`${prefix}.${k}`, x, out, true);
    else if (k !== 'overrides') out.set(`${prefix}.${k}`, x);
  }
}

// The directories from `dir` up to `root`, nearest first.
function chainOf(dir: string, root: string): string[] {
  const rel = relative(root, dir);
  if (rel.startsWith('..') || isAbsolute(rel)) return [dir];
  const out = [dir];
  for (let d = dir; relative(root, d) !== '' && dirname(d) !== d;) { d = dirname(d); out.push(d); }
  return out;
}

function packageJson(dir: string): Record<string, unknown> | null {
  const text = read(join(dir, 'package.json'));
  return text === null ? null : json(text);
}

// tsconfig compilerOptions with relative `extends` followed, the nearest file overriding its bases.
function tsOptions(file: string, seen: Set<string>, hops: number): Record<string, unknown> {
  const path = real(file);
  if (seen.has(path) || hops > 5) return {};
  seen.add(path);
  const cfg = json(read(path) ?? '');
  if (!cfg) return {};
  const base: Record<string, unknown> = {};
  const ext = cfg['extends'];
  for (const e of Array.isArray(ext) ? ext : [ext]) {
    if (typeof e !== 'string' || !e.startsWith('.')) continue;
    const target = resolve(dirname(path), e);
    Object.assign(base, tsOptions(extname(target) === '' ? `${target}.json` : target, seen, hops + 1));
  }
  return isRecord(cfg['compilerOptions']) ? { ...base, ...cfg['compilerOptions'] } : base;
}

const word = (name: string): RegExp => new RegExp(`(?<![\\w-])${name}(?![\\w-])`);

function filesIn(dir: string): string[] {
  try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).sort(); } catch { return []; }
}

export function readFacts(ruleFile: string, override?: { files?: readonly string[] }): Facts {
  const dir = real(dirname(resolve(ruleFile)));
  const top = gitLines(dir, ['rev-parse', '--show-toplevel'])?.[0];
  const inRepo = top !== undefined;
  const root = top === undefined ? dir : real(top);
  const chain = chainOf(dir, root);
  const rel = (d: string, name: string): string => posix(relative(root, join(d, name)));

  // The nearest package.json decides, even when it does not parse.
  const pkgDir = chain.find((d) => existsSync(join(d, 'package.json')));
  const pj = pkgDir === undefined ? null : packageJson(pkgDir);
  const scripts: Record<string, string> = {};
  let pkg: Facts['pkg'] = null;
  if (pkgDir !== undefined && pj) {
    const deps = new Set<string>();
    const versions: Record<string, string> = {};
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const group = pj[k];
      if (!isRecord(group)) continue;
      for (const [name, range] of Object.entries(group)) {
        deps.add(name);
        if (typeof range === 'string' && !Object.hasOwn(versions, name)) versions[name] = range;
      }
    }
    if (isRecord(pj['scripts'])) for (const [k, v] of Object.entries(pj['scripts'])) if (typeof v === 'string') scripts[k] = v;
    const str = (k: string): string | null => (typeof pj[k] === 'string' ? pj[k] : null);
    pkg = { path: rel(pkgDir, 'package.json'), name: str('name'), description: str('description'), deps, versions, scripts };
  }

  const config = new Map<string, unknown>();
  const unreadable: string[] = [];
  const markUnreadable = (d: string, name: string): void => { const r = rel(d, name); if (!unreadable.includes(r)) unreadable.push(r); };

  // Per tool the nearest directory with any of its configs decides.
  for (const tool of TOOLS) {
    for (const d of chain) {
      let found = false;
      for (const name of tool.files) {
        const text = read(join(d, name));
        if (text === null) continue;
        found = true;
        const parsed = tool.parse(text);
        if (parsed) flatten(tool.prefix, parsed, config, tool.prefix === 'biome'); else markUnreadable(d, name);
        break;
      }
      const own = d === pkgDir ? pj : packageJson(d);
      const embedded = tool.pkgKey === undefined ? undefined : own?.[tool.pkgKey];
      if (!found && isRecord(embedded)) { found = true; flatten(tool.prefix, embedded, config, false); }
      for (const name of tool.code) if (existsSync(join(d, name))) { found = true; markUnreadable(d, name); }
      if (found) break;
    }
  }

  const editorconfig = chain.map((d) => read(join(d, '.editorconfig'))).find((t) => t !== null);
  if (editorconfig) for (const [k, v] of Object.entries(parseEditorconfig(editorconfig))) config.set(`editorconfig.${k}`, v);

  const tsconfig = chain.map((d) => join(d, 'tsconfig.json')).find((p) => existsSync(p));
  if (tsconfig !== undefined) for (const [k, v] of Object.entries(tsOptions(tsconfig, new Set(), 0))) config.set(`tsconfig.${k}`, v);

  // Proof that a tool runs: its name as a word in a script, a git hook or a CI workflow.
  const sources = Object.values(scripts);
  for (const d of new Set([root, dir])) {
    for (const f of ['lefthook.yml', 'lefthook.yaml', '.pre-commit-config.yaml']) sources.push(read(join(d, f)) ?? '');
    for (const f of filesIn(join(d, '.husky'))) sources.push(read(join(d, '.husky', f)) ?? '');
    for (const f of filesIn(join(d, '.github', 'workflows'))) if (/\.ya?ml$/.test(f)) sources.push(read(join(d, '.github', 'workflows', f)) ?? '');
  }
  const runs = new Set<Tool>();
  for (const t of TOOL_WORDS) if (sources.some((s) => word(t).test(s))) runs.add(t);
  if (tsconfig !== undefined) runs.add('tsc');

  const lockfiles = new Set<string>();
  for (const d of chain) for (const f of LOCKFILES) if (existsSync(join(d, f))) lockfiles.add(f);

  const deny: string[] = [];
  for (const d of new Set([root, dir])) {
    for (const f of ['settings.json', 'settings.local.json']) {
      const perms = json(read(join(d, '.claude', f)) ?? '')?.['permissions'];
      const list = isRecord(perms) ? perms['deny'] : undefined;
      if (Array.isArray(list)) for (const x of list) if (typeof x === 'string' && !deny.includes(x)) deny.push(x);
    }
  }

  const git = override?.files === undefined && inRepo ? gitLines(root, ['ls-files', '-z', '-co', '--exclude-standard']) : [];
  const filesKnown = git !== null;
  const listed = override?.files ?? git ?? [];
  const files = new Set(listed.map(posix));
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = LANGUAGES[extname(f).toLowerCase()];
    if (lang !== undefined) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const languages = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);

  const docs: { file: string; text: string }[] = [];
  const addDoc = (d: string, name: string): void => {
    const file = rel(d, name);
    if (docs.some((x) => x.file === file)) return;
    for (const p of (read(join(d, name)) ?? '').split(/\r?\n\s*\r?\n/)) if (p.trim() !== '') docs.push({ file, text: p.trim() });
  };
  for (const d of new Set([dir, root])) addDoc(d, 'README.md');
  for (const f of filesIn(join(root, 'docs'))) if (f.toLowerCase().endsWith('.md')) addDoc(join(root, 'docs'), f);

  return { root, dir, inRepo, pkg, lockfiles, config, unreadable, runs, deny, files, filesKnown, languages, docs };
}
