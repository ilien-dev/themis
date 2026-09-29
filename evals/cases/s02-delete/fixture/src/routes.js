import { toCsv } from './export/csv.js';
import { toLegacyCsv } from './export/legacyCsv.js';
import features from '../config/features.json' with { type: 'json' };

export const routes = {
  '/export/csv': (rows) => toCsv(rows),
  ...(features.legacyCsv ? { '/export/legacy': (rows) => toLegacyCsv(rows) } : {}),
};
