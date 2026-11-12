// Collects the snapshots of a held-out corpus: node tests/gate/holdout/collect.mjs [sources.json] [--extras]
// Without arguments it rebuilds the first corpus (sources.json next to this script, snapshots beside it).
// The snapshots are written next to the sources file, so the second corpus is
//   node tests/gate/holdout/collect.mjs tests/gate/holdout2/sources.json --extras
// --extras also stores every package.json of the tree (up to 30, at its real path) and the licence file.
// Each entry of sources.json is "owner/repo@sha", or "owner/repo@sha#AGENTS.md" to name the rule file
// (the default is CLAUDE.md, then AGENTS.md). Everything is read with the authenticated `gh` CLI at that
// exact commit and written to <owner>__<repo>/ next to this script:
//   rules.md     the rule file (not named CLAUDE.md or AGENTS.md: a plugin intercepts those names)
//   files.txt    every file of the tree, one path per line
//   the files the gate reads (package.json, lockfile names, linter, formatter and hook configs, .gitignore,
//   README, docs). The snapshots here were collected before .gitignore joined that list and do not have it.
// Configs the gate cannot parse (JavaScript, TypeScript, YAML ESLint and commitlint configs) and the
// lockfiles are stored as empty files: the gate only needs to know they exist.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const EXTRAS = args.includes('--extras');
const sourcesPath = resolve(args.find((a) => !a.startsWith('--')) ?? join(here, 'sources.json'));
const outDir = dirname(sourcesPath);
const MAX_PACKAGES = 30;
const CAP = 200 * 1024;
const MAX_DOCS = 20;

const gh = (args) => execFileSync('gh', ['api', ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
const blob = (repo, sha) => gh(['-H', 'Accept: application/vnd.github.raw', `repos/${repo}/git/blobs/${sha}`]);

const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
const CODE = /\.(?:[cm]?js|[cm]?ts)$/;
const CONFIG = [
  /^\.prettierrc(?:\.[\w.]+)?$/, /^prettier\.config\.[\w.]+$/, /^\.eslintrc(?:\.[\w.]+)?$/, /^eslint\.config\.[\w.]+$/,
  /^biome\.jsonc?$/, /^\.editorconfig$/, /^tsconfig\.json$/, /^lefthook\.ya?ml$/, /^\.pre-commit-config\.yaml$/,
  /^\.commitlintrc(?:\.[\w.]+)?$/, /^commitlint\.config\.[\w.]+$/, /^package\.json$/, /^README\.md$/, /^\.gitignore$/,
];
// Stored empty: lockfiles, code configs, and the YAML ESLint and commitlint configs the gate does not parse.
const EMPTY = (name) => LOCKFILES.includes(name) || CODE.test(name) || /^\.(?:eslintrc|commitlintrc)\.ya?ml$/.test(name);

function collect(entry) {
  const m = /^([\w.-]+\/[\w.-]+)@([0-9a-f]{40})(?:#(CLAUDE\.md|AGENTS\.md))?$/.exec(entry);
  if (!m) throw new Error(`bad source ${entry}`);
  const [, repo, sha, named] = m;
  const out = join(outDir, repo.replace('/', '__'));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const tree = JSON.parse(gh([`repos/${repo}/git/trees/${sha}?recursive=1`]).toString('utf8'));
  const blobs = tree.tree.filter((e) => e.type === 'blob');
  const bySha = new Map(blobs.map((e) => [e.path, e]));
  const write = (path, content) => {
    const target = join(out, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const store = (path) => {
    const e = bySha.get(path);
    if (e === undefined) return false;
    if (EMPTY(posix.basename(path))) { write(path, ''); return true; }
    write(path, blob(repo, e.sha).subarray(0, CAP));
    return true;
  };

  const ruleFile = named ?? ['CLAUDE.md', 'AGENTS.md'].find((f) => bySha.has(f));
  if (ruleFile === undefined || !bySha.has(ruleFile)) throw new Error(`${repo}: no rule file at the root`);
  write('rules.md', blob(repo, bySha.get(ruleFile).sha));
  write('files.txt', `${blobs.map((e) => e.path).join('\n')}\n`);

  const root = blobs.map((e) => e.path).filter((p) => !p.includes('/'));
  for (const p of root) if (CONFIG.some((r) => r.test(p)) || LOCKFILES.includes(p)) store(p);
  for (const p of blobs.map((e) => e.path)) {
    if (p === '.claude/settings.json') store(p);
    else if (/^\.husky\/[^/]+$/.test(p)) store(p);
    else if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)) store(p);
  }
  // docs/CLAUDE.md and docs/AGENTS.md are left out: a plugin intercepts those names.
  // A relative `extends` of the root tsconfig, followed a few hops.
  let current = 'tsconfig.json';
  for (let hop = 0; hop < 5 && bySha.has(current); hop++) {
    let next = null;
    try {
      const text = readFileSync(join(out, current), 'utf8');
      const ext = /"extends"\s*:\s*"(\.[^"]+)"/.exec(text)?.[1];
      if (ext !== undefined) {
        const target = posix.normalize(posix.join(posix.dirname(current), ext));
        next = [target, `${target}.json`].find((t) => bySha.has(t) && !t.startsWith('..')) ?? null;
      }
    } catch { /* not stored or unreadable: no further hop */ }
    if (next === null) break;
    store(next);
    current = next;
  }
  if (EXTRAS) {
    // .gitignore is in CONFIG for the root; the nested package.json files, shallowest first, and the licence.
    const packages = blobs.map((e) => e.path).filter((p) => /(?:^|\/)package\.json$/.test(p) && !p.split('/').includes('node_modules') && p !== 'package.json');
    packages.sort((a, b) => a.split('/').length - b.split('/').length || (a < b ? -1 : 1));
    for (const p of packages.slice(0, MAX_PACKAGES - 1)) store(p);
    for (const p of root) if (/^(?:LICEN[SC]E|COPYING)(?:\.md)?$/.test(p)) store(p);
  }
  const docs = blobs.map((e) => e.path).filter((p) => /^docs\/[^/]+\.md$/i.test(p) && !/^(?:claude|agents)\.md$/i.test(posix.basename(p))).sort().slice(0, MAX_DOCS);
  for (const p of docs) store(p);
  return { repo, sha, ruleFile, truncated: tree.truncated === true, files: blobs.length };
}

const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
for (const entry of sources) {
  const r = collect(entry);
  console.log(`${r.repo}@${r.sha.slice(0, 7)} ${r.ruleFile} ${r.files} files${r.truncated ? ' (tree truncated)' : ''}`);
}
