// Readers for the config formats the gate looks at. None throws: text that does not parse gives
// null (JSONC) or whatever lines did parse (YAML, editorconfig).

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const unbom = (t: string): string => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);

// JSON with comments and trailing commas (tsconfig, biome.jsonc, .eslintrc).
export function parseJsonc(text: string): unknown {
  let out = '';
  let i = 0;
  const s = unbom(text);
  while (i < s.length) {
    const c = s.charAt(i);
    const next = s.charAt(i + 1);
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && s.charAt(j) !== '"') j += s.charAt(j) === '\\' ? 2 : 1;
      out += s.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && next === '/') {
      while (i < s.length && s.charAt(i) !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end === -1 ? s.length : end + 2;
    } else {
      if (c === '}' || c === ']') out = out.replace(/,(\s*)$/, '$1');
      out += c;
      i++;
    }
  }
  try { return JSON.parse(out); } catch { return null; }
}

function scalar(raw: string): unknown {
  const v = raw.trim();
  const quoted = /^(["'])(.*?)\1/.exec(v);
  if (quoted) return quoted[2] ?? '';
  const bare = v.replace(/\s+#.*$/, '').trim();
  if (bare === 'true') return true;
  if (bare === 'false') return false;
  if (bare === 'null' || bare === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(bare)) return Number(bare);
  return bare;
}

// `key: scalar` lines at the top level; nested blocks, lists and anything indented are skipped.
export function parseFlatYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of unbom(text).split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w.-]*)\s*:(?:\s+(.*))?$/.exec(line);
    if (!m) continue;
    const value = (m[2] ?? '').trim();
    if (value === '' || value.startsWith('#') || value === '|' || value === '>') continue;
    out[m[1] ?? ''] = scalar(value);
  }
  return out;
}

// Keys before any section plus the [*] section; keys and values are case-insensitive by spec.
export function parseEditorconfig(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let active = true;
  for (const raw of unbom(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
    const section = /^\[(.*)\]$/.exec(line);
    if (section) { active = section[1] === '*'; continue; }
    const kv = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(line);
    if (active && kv) out[(kv[1] ?? '').toLowerCase()] = (kv[2] ?? '').trim().toLowerCase();
  }
  return out;
}
