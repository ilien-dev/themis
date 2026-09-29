// Aggregates recorded runs into a markdown table: pass rate and mean cost per case and arm.
//   node evals/report.mjs base=r1-base,r2,r3,r3-lang themis=r4 control=r3 [min=r3-min]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'results');
const arms = process.argv.slice(2).map((a) => { const [name, tags] = a.split('='); return { name, tags: tags.split(',') }; });

const rows = {}; // case -> arm -> runs
for (const { name, tags } of arms) {
  const armKey = name === 'min' ? 'themis' : name;
  for (const tag of tags) {
    if (!existsSync(join(ROOT, tag))) continue;
    for (const c of readdirSync(join(ROOT, tag))) {
      if (c.endsWith('.json')) continue;
      for (const f of readdirSync(join(ROOT, tag, c)).filter((f) => f.startsWith(armKey + '-') && f.endsWith('.json'))) {
        const r = JSON.parse(readFileSync(join(ROOT, tag, c, f), 'utf8'));
        if (r.invalid || r.pass === null) continue;
        ((rows[c] ??= {})[name] ??= []).push(r);
      }
    }
  }
}

const cell = (rs) => (rs?.length ? `${rs.filter((r) => r.pass).length}/${rs.length}` : '—');
const cost = (rs) => (rs?.length ? '$' + (rs.reduce((s, r) => s + (r.cost || 0), 0) / rs.length).toFixed(3) : '—');
const names = arms.map((a) => a.name);
console.log(`| case | ${names.map((n) => `${n} pass`).join(' | ')} | ${names.map((n) => `${n} $/run`).join(' | ')} |`);
console.log(`|---|${names.map(() => '---:').join('|')}|${names.map(() => '---:').join('|')}|`);
for (const c of Object.keys(rows).sort()) {
  console.log(`| ${c} | ${names.map((n) => cell(rows[c][n])).join(' | ')} | ${names.map((n) => cost(rows[c][n])).join(' | ')} |`);
}
