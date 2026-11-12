// Stores the source files that the rules cite: node tests/gate/holdout/fetch-cited.mjs <cases.jsonl> <corpus directory>
// The cases are the labelled corpus (or the unlabelled one unlabel.mjs writes); only `repo` and `rule` are read.
//   node tests/gate/holdout/fetch-cited.mjs tests/gate/holdout.jsonl tests/gate/holdout
//   node tests/gate/holdout/fetch-cited.mjs tests/gate/holdout2.jsonl tests/gate/holdout2
// Every backticked span, bold span and parenthesised token of a rule that looks like a path is matched against the
// snapshot's files.txt (exact path, or the one path ending with /<token>, the shortest when several do). Each hit is
// downloaded once, at the commit of sources.json, to its real relative path in the snapshot, when it is text, at most
// 64 KB, not a lockfile, not named CLAUDE.md or AGENTS.md, and not already stored; at most 80 files per repository.
// Nothing here looks at what a rule says beyond which paths it names.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const [jsonl, dir] = process.argv.slice(2).map((p) => resolve(p));
if (jsonl === undefined || dir === undefined) throw new Error('usage: fetch-cited.mjs <cases.jsonl> <corpus directory>');
const MAX_BYTES = 64 * 1024;
const MAX_FILES = 80;
const BINARY = /\.(?:png|jpe?g|gif|webp|ico|bmp|svgz|pdf|zip|gz|tgz|tar|bz2|xz|7z|rar|woff2?|ttf|otf|eot|mp[34]|wav|ogg|webm|mov|avi|wasm|so|dll|dylib|exe|bin|class|jar|sqlite3?|db|psd|ai|heic|node)$/i;
const LOCK = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|go\.sum)$/;

const gh = (args) => execFileSync('gh', ['api', ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

const sources = new Map(JSON.parse(readFileSync(join(dir, 'sources.json'), 'utf8')).map((s) => {
  const m = /^([^@]+)@([0-9a-f]{40})/.exec(s);
  return [m[1].replace('/', '__'), { repo: m[1], sha: m[2] }];
}));

// The path-like tokens of a rule.
function tokens(rule) {
  const raw = [];
  for (const m of rule.matchAll(/`([^`\n]+)`/g)) raw.push(m[1]);
  for (const m of rule.matchAll(/\*\*([^*\n]+)\*\*/g)) raw.push(m[1]);
  for (const m of rule.matchAll(/\(([^()\s]+)\)/g)) raw.push(m[1]);
  const out = new Set();
  for (let t of raw) {
    t = t.trim().replace(/\\/g, '/').replace(/^["']+|["',.;]+$/g, '');
    t = t.replace(/::[\w$.]+$/, '').replace(/#L\d+(?:-L?\d+)?$/, '').replace(/:\d+(?:-\d+)?$/, '');
    t = t.replace(/^(?:\.\/)+/, '');
    if (t === '' || /\s/.test(t) || /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || t.startsWith('/') || t.startsWith('../') || t.includes('*')) continue;
    if (!/^[\w@.+\-/[\]$~]+$/.test(t) || !/[./]/.test(t)) continue;
    out.add(t.replace(/\/$/, ''));
  }
  return [...out];
}

const byRepo = new Map();
for (const line of readFileSync(jsonl, 'utf8').split('\n').filter(Boolean)) {
  const c = JSON.parse(line);
  const name = c.repo.split('/').pop();
  if (!byRepo.has(name)) byRepo.set(name, []);
  byRepo.get(name).push(...tokens(c.rule));
}

const total = { hits: 0, downloaded: 0, skipped: {} };
const skip = (why) => { total.skipped[why] = (total.skipped[why] ?? 0) + 1; };
for (const [name, toks] of [...byRepo].sort()) {
  const src = sources.get(name);
  if (src === undefined) throw new Error(`no source for ${name}`);
  const files = readFileSync(join(dir, name, 'files.txt'), 'utf8').split('\n').filter(Boolean);
  const set = new Set(files);
  const hits = new Set();
  for (const t of toks) {
    if (set.has(t)) { hits.add(t); continue; }
    const ends = files.filter((f) => f.endsWith(`/${t}`));
    if (ends.length > 0) hits.add(ends.sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0]);
  }
  total.hits += hits.size;
  let sizes = null;
  let n = 0;
  for (const path of [...hits].sort()) {
    const base = path.split('/').pop();
    if (/^(?:claude|agents)\.md$/i.test(base)) { skip('named CLAUDE.md or AGENTS.md'); continue; }
    if (BINARY.test(base)) { skip('binary type'); continue; }
    if (LOCK.test(path)) { skip('lockfile'); continue; }
    const target = join(dir, name, path);
    if (existsSync(target)) { skip('already stored'); continue; }
    if (n >= MAX_FILES) { skip('over 80 files for the repository'); continue; }
    try {
      sizes ??= new Map(JSON.parse(gh([`repos/${src.repo}/git/trees/${src.sha}?recursive=1`]).toString('utf8')).tree.map((e) => [e.path, e.size ?? 0]));
      if ((sizes.get(path) ?? 0) > MAX_BYTES) { skip('over 64 KB'); continue; }
      const data = gh(['-H', 'Accept: application/vnd.github.raw', `repos/${src.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${src.sha}`]);
      if (data.length > MAX_BYTES) { skip('over 64 KB'); continue; }
      if (data.includes(0)) { skip('binary content'); continue; }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
      n++; total.downloaded++;
    } catch (e) { skip(`download error (${String(e.message).split('\n')[0].slice(0, 60)})`); }
  }
}
console.log(JSON.stringify(total, null, 1));
