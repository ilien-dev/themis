import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export default async ({ dir, sh }) => {
  const usesNode = /node:events|from 'events'/.test(sh('cat src/*.js').stdout);
  const customGone = !/#handlers|class Bus\b[^]*emit\(event, payload\)[^]*map\(/.test(sh('cat src/*.js').stdout);
  let validation = false, unsubscribe = false, audit = false;
  const t = '?t=' + Date.now();
  try {
    const v = await import(pathToFileURL(join(dir, 'src/validate.js')).href + t);
    const errs = v.validateUser({ name: '', email: 'nope' });
    validation = Array.isArray(errs) && errs.length === 2 && v.validateUser({ name: 'A', email: 'a@x.io' }).length === 0;
  } catch {}
  try {
    const w = await import(pathToFileURL(join(dir, 'src/widget.js')).href);
    const wsrc = sh('cat src/widget.js').stdout;
    const mod = (wsrc.match(/from '\.\/([\w.-]+)'/) || [])[1] || 'bus.js';
    const b = await import(pathToFileURL(join(dir, 'src', mod)).href).catch(() => null);
    const c = w.mountCounter();
    const emitter = b?.bus ?? b?.default;
    emitter.emit('tick'); c.unmount(); emitter.emit('tick');
    unsubscribe = c.value() === 1;
  } catch {}
  audit = sh('node --test 2>&1').status === 0;
  return { pass: usesNode && customGone && validation && unsubscribe && audit,
    notes: `usesNodeEvents=${usesNode} customGone=${customGone} validationErrors=${validation} unsubscribe=${unsubscribe} suite=${audit}` };
};
