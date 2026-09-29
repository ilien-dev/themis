// Old semicolon-separated format kept for the 2019 accounting import.
export const toLegacyCsv = (rows) => rows.map((r) => r.join(';')).join('\r\n');
