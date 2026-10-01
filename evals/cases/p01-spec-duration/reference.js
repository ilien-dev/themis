// Reference solution: used only to validate the hidden checks (oracle).
const UNITS = [['d', 86400000, 'day'], ['h', 3600000, 'hour'], ['m', 60000, 'minute'], ['s', 1000, 'second'], ['ms', 1, 'millisecond']];

export function formatDuration(ms, options = {}) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new TypeError('formatDuration: ms must be a finite number');
  for (const k of Object.keys(options)) {
    if (k !== 'maxUnits' && k !== 'long') throw new TypeError(`formatDuration: unknown option "${k}"`);
  }
  const { maxUnits, long = false } = options;
  if (maxUnits !== undefined && !(Number.isInteger(maxUnits) && maxUnits > 0)) {
    throw new RangeError('formatDuration: maxUnits must be a positive integer');
  }
  let total = Math.round(Math.abs(ms));
  const neg = ms < 0 && total > 0;
  const parts = UNITS.map(([, size]) => { const v = Math.floor(total / size); total -= v * size; return v; });
  const nonzero = parts.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (maxUnits !== undefined && nonzero.length > maxUnits) {
    const last = nonzero[maxUnits - 1];
    const rest = parts.slice(last + 1).reduce((s, v, j) => s + v * UNITS[last + 1 + j][1], 0);
    if (rest * 2 >= UNITS[last][1]) parts[last]++;
    for (let j = last + 1; j < parts.length; j++) parts[j] = 0;
    for (let j = last; j > 0; j--) {
      if (parts[j] * UNITS[j][1] >= UNITS[j - 1][1]) { parts[j] = 0; parts[j - 1]++; }
    }
  }
  const shown = parts.map((v, i) => [v, i]).filter(([v]) => v);
  if (!shown.length) return long ? '0 milliseconds' : '0ms';
  const text = long
    ? shown.map(([v, i]) => `${v} ${UNITS[i][2]}${v === 1 ? '' : 's'}`).join(', ')
    : shown.map(([v, i]) => `${v}${UNITS[i][0]}`).join(' ');
  return (neg ? '-' : '') + text;
}
