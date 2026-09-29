// Parses durations like "1h30m", "45s", "250ms" or "2h 5m 10s" into milliseconds.
const UNITS = { h: 3600000, m: 60000, s: 1000, ms: 1 };

export function parseDuration(input) {
  if (typeof input !== 'string') throw new TypeError('duration must be a string');
  const text = input.trim().toLowerCase();
  if (text === '') throw new SyntaxError('empty duration');
  let total = 0;
  let consumed = 0;
  for (const m of text.matchAll(/(\d+)\s*(ms|h|m|s)\s*/g)) {
    if (m.index !== consumed) throw new SyntaxError(`unexpected input at ${consumed}`);
    total += Number(m[1]) * UNITS[m[2]];
    consumed += m[0].length;
  }
  if (consumed !== text.length) throw new SyntaxError(`unexpected input at ${consumed}`);
  return total;
}
