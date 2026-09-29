import { readFileSync } from 'node:fs';
export function loadRatings(path = new URL('../data/ratings.csv', import.meta.url)) {
  const [, ...rows] = readFileSync(path, 'utf8').trim().split('\n');
  const out = {};
  for (const row of rows) {
    const [product, rating] = row.split(',');
    (out[product] ??= []).push(Number(rating || undefined));
  }
  return out;
}
