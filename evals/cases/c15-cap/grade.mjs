import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const tok = (s) => Math.ceil(s.length / 3.6);
const KEYS = [/9457|problem\+json/i, /ISO.?8601|UTC/i, /flags\.json/, /query\.js/, /request_id/, /idempot/i, /JSDoc/i, /\.env\.example/, /tenant/i, /rates\.js/];
export default async ({ dir }) => {
  const t = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  const got = KEYS.filter((k) => k.test(t)).length;
  return { pass: got >= 9 && tok(t) <= 2500, notes: `tokens=${tok(t)} conventions=${got}/10`, metric: tok(t) };
};
