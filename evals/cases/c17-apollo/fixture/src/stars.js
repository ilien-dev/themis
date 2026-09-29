import { loadRatings } from './loader.js';
export function stars(product) {
  const rs = loadRatings()[product] ?? [];
  const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
  return `${avg.toFixed(1)} stars`;
}
