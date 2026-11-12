// Writes tests/gate/holdout-unlabelled.jsonl: node tests/gate/holdout/unlabel.mjs
// One case per rule of each snapshot's rules.md (the first 60 when a file has more), without `expect`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { parseRules } = await import(pathToFileURL(join(here, '..', '..', '..', 'hooks', 'gate', 'extract.ts')).href);
const MAX = 60;
const sources = JSON.parse(readFileSync(join(here, 'sources.json'), 'utf8'));
const fileOf = new Map(sources.map((s) => [/^([^@]+)@/.exec(s)[1].replace('/', '__'), /#(\S+)$/.exec(s)?.[1] ?? 'CLAUDE.md']));

const lines = [];
const odd = [];
for (const dir of readdirSync(here, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const text = readFileSync(join(here, dir, 'rules.md'), 'utf8').replace(/^\uFEFF/, '');
  parseRules(text).slice(0, MAX).forEach((r, i) => {
    const id = `${dir}-${String(i + 1).padStart(2, '0')}`;
    if (parseRules(r.text).length !== 1) odd.push(id);
    lines.push(JSON.stringify({ id, repo: `tests/gate/holdout/${dir}`, file: fileOf.get(dir) ?? 'CLAUDE.md', rule: r.text, kind: r.kind, line: r.line }));
  });
}
writeFileSync(join(here, '..', 'holdout-unlabelled.jsonl'), `${lines.join('\n')}\n`);
console.log(`${lines.length} rules; ${odd.length} that do not re-parse as one rule: ${odd.join(' ')}`);
