// Writes the unlabelled cases of a held-out corpus: node tests/gate/holdout/unlabel.mjs [corpus directory] [cap] [output file]
// One case per rule of each snapshot's rules.md (the first <cap> when a file has more), without `expect`.
// The defaults rebuild the first corpus: tests/gate/holdout, 60, tests/gate/holdout-unlabelled.jsonl. The second:
//   node tests/gate/holdout/unlabel.mjs tests/gate/holdout2 40 tests/gate/holdout2-unlabelled.jsonl
// The output is what the labellers were given. It is not stored in the repository (tests/gate/.gitignore): the
// labelled .jsonl holds the same rules, and this script writes it again from the rebuilt snapshots.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { parseRules } = await import(pathToFileURL(join(here, '..', '..', '..', 'hooks', 'gate', 'extract.ts')).href);
const dir0 = resolve(process.argv[2] ?? here);
const MAX = Number(process.argv[3] ?? 60);
const outFile = resolve(process.argv[4] ?? join(here, '..', 'holdout-unlabelled.jsonl'));
const sources = JSON.parse(readFileSync(join(dir0, 'sources.json'), 'utf8'));
const fileOf = new Map(sources.map((s) => [/^([^@]+)@/.exec(s)[1].replace('/', '__'), /#(\S+)$/.exec(s)?.[1] ?? 'CLAUDE.md']));

const lines = [];
const odd = [];
for (const dir of readdirSync(dir0, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const text = readFileSync(join(dir0, dir, 'rules.md'), 'utf8').replace(/^\uFEFF/, '');
  parseRules(text).slice(0, MAX).forEach((r, i) => {
    const id = `${dir}-${String(i + 1).padStart(2, '0')}`;
    if (parseRules(r.text).length !== 1) odd.push(id);
    lines.push(JSON.stringify({ id, repo: `tests/gate/${basename(dir0)}/${dir}`, file: fileOf.get(dir) ?? 'CLAUDE.md', rule: r.text, kind: r.kind, line: r.line }));
  });
}
writeFileSync(outFile, `${lines.join('\n')}\n`);
console.log(`${lines.length} rules; ${odd.length} that do not re-parse as one rule: ${odd.join(' ')}`);
