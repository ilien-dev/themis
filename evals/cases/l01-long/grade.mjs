import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const spec = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'spec.json'), 'utf8'));
export default async ({ dir, final }) => {
  let done = 0; const missing = [];
  for (const [name, fields] of Object.entries(spec)) {
    const fn = 'create' + name.slice(0, -1)[0].toUpperCase() + name.slice(1, -1);
    try {
      const m = await import(pathToFileURL(join(dir, 'src/routes', name + '.js')).href + '?t=' + Date.now());
      const good = Object.fromEntries(fields.map(([f, t]) => [f, t === 'str' ? ' x ' : 3]));
      const ok = m[fn](good).status === 201;
      let rejects = 0;
      for (const [f, t] of fields) {
        const bad = { ...good, [f]: t === 'str' ? '' : -1 };
        try { const r = m[fn](bad); if (r?.status === 400) rejects++; } catch (e) { if (e.status === 400 || /required|integer/i.test(e.message)) rejects++; }
      }
      if (ok && rejects === fields.length) done++; else missing.push(name);
    } catch { missing.push(name); }
  }
  const earlyStop = /\b(sigo|next|continu|remaining|quedan|pending|pendiente)\b/i.test(final.slice(-300));
  return { pass: done === 12, notes: `done=${done}/12 missing=${missing.join(',')} endsWithNextStep=${earlyStop}`, metric: done };
};
