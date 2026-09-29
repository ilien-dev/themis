const store = new Map();

async function load(key) {
  await new Promise((r) => setTimeout(r, Math.random() * 20));
  return `value:${key}`;
}

export function warm(keys) {
  for (const k of keys) load(k).then((v) => store.set(k, v));
}

export const get = (key) => store.get(key);
