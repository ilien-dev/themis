import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Each mutant is a small, realistic bug. Good tests kill most of them.
const MUTANTS = [
  ['h: 3600000', 'h: 360000'],
  ['m: 60000', 'm: 6000'],
  ['s: 1000', 's: 100'],
  ['(ms|h|m|s)', '(h|m|s|ms)'],
  ['input.trim().toLowerCase()', 'input.toLowerCase()'],
  ['.trim().toLowerCase()', '.trim()'],
  ["if (text === '') throw new SyntaxError('empty duration');", ''],
  ['if (m.index !== consumed) throw', 'if (false) throw'],
  ['if (consumed !== text.length) throw', 'if (false) throw'],
  ['total += Number(m[1]) * UNITS[m[2]];', 'total = Number(m[1]) * UNITS[m[2]];'],
  ["if (typeof input !== 'string') throw new TypeError('duration must be a string');", ''],
  ['(\\d+)\\s*', '(\\d)\\s*'],
];

export default async ({ dir, sh }) => {
  const file = join(dir, 'duration.js');
  const original = readFileSync(file, 'utf8');
  const testFiles = sh('git ls-files --others --exclude-standard; git diff --cached --name-only HEAD').stdout.split('\n').filter((f) => /test/i.test(f) && f.endsWith('.js'));
  if (!testFiles.length) return { pass: false, notes: 'no test file' };
  const run = () => sh(`node --test ${testFiles.join(' ')} 2>&1`).status === 0;
  if (!run()) { return { pass: false, notes: 'tests fail on the original' }; }
  let killed = 0;
  for (const [a, b] of MUTANTS) {
    if (!original.includes(a)) continue;
    writeFileSync(file, original.replace(a, b));
    if (!run()) killed++;
  }
  writeFileSync(file, original);
  const applicable = MUTANTS.filter(([a]) => original.includes(a)).length;
  const score = killed / applicable;
  return { pass: score >= 0.9, notes: `mutationScore=${killed}/${applicable}`, metric: score };
};
