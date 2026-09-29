// Parses "YYYY-MM-DD" into a UTC Date.
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m, d));
}
