export const toCsv = (rows) => rows.map((r) => r.join(',')).join('\n');
