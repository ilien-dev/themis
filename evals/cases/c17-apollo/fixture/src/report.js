import { loadRatings } from './loader.js';
export function ratedCount() {
  return Object.values(loadRatings()).reduce((n, rs) => n + rs.length, 0);
}
