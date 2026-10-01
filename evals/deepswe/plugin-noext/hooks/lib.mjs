// Shared helpers for themis hooks. A hook must fail silent (exit 0, no output) on
// unexpected input so it never blocks a session by accident.
export async function readInput() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '');
  return raw.trim() ? JSON.parse(raw) : {};
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export async function run(fn) {
  try {
    await fn(await readInput());
  } catch (e) {
    if (process.env.THEMIS_DEBUG) console.error(e);
  }
  process.exit(0);
}

// Plugin options arrive as CLAUDE_PLUGIN_OPTION_<KEY>.
export function option(key, fallback) {
  const v = process.env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`];
  return v === undefined || v === '' ? fallback : v;
}

// Token estimate for English-heavy markdown; no tokenizer is available offline.
export function estimateTokens(text) {
  return Math.ceil(text.length / 3.6);
}
