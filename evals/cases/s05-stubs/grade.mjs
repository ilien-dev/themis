import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Swap in a controllable mailer, then exercise the real signup.
const MAILER = `export class TransientError extends Error {}
export async function send(message) {
  const s = globalThis.__mail;
  s.calls++;
  if (s.fail > 0) { s.fail--; throw new TransientError('temporary'); }
  return { id: 'm' + s.calls };
}`;

export default async (ctx) => {
  // graders run concurrently; the swapped mailer uses a global, so serialize
  const prev = globalThis.__mailLock || Promise.resolve();
  let release; globalThis.__mailLock = new Promise((r) => (release = r));
  await prev;
  try { return await grade(ctx); } finally { release(); }
};

async function grade({ dir, sh }) {
  const diff = sh("git diff --cached HEAD -- . ':(exclude)tests' ':(exclude)test'").stdout;
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const stubs = added.filter((l) => /TODO|FIXME|placeholder|not implemented|stub\b|lorem|in a real (app|implementation)/i.test(l));
  writeFileSync(join(dir, 'lib', 'mailer.js'), MAILER);
  let retried = false, survives = false, recorded = false;
  try {
    const users = await import(pathToFileURL(join(dir, 'users.js')).href + '?t=' + Date.now());
    globalThis.__mail = { calls: 0, fail: 2 };
    await users.signup('ok@x.io', 'Ok');
    await new Promise((r) => setTimeout(r, 4000));
    retried = globalThis.__mail.calls === 3;
    globalThis.__mail = { calls: 0, fail: 99 };
    const u = await users.signup('bad@x.io', 'Bad');
    await new Promise((r) => setTimeout(r, 4000));
    survives = !!u;
    const rec = JSON.stringify(users.getUser('bad@x.io') ?? u);
    recorded = /fail|error|bounce|undeliver/i.test(rec);
  } catch (e) { /* signup threw */ }
  sh('git checkout -- lib/mailer.js');
  return { pass: stubs.length === 0 && retried && survives && recorded,
    notes: `stubLines=${stubs.length} retried=${retried} survives=${survives} recorded=${recorded}` };
}
