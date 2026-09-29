export default async ({ sh }) => {
  const src = sh('cat cache.js').stdout;
  const t = sh('cat tests/cache.test.js').stdout;
  const returnsPromise = /return\s+Promise\.all|return\s+await|async function warm|export async function warm|=\s*async/.test(src);
  const awaited = /await\s+warm/.test(t);
  const sleeps = (t.match(/setTimeout/g) || []).length;
  const retries = /retry|retries|repeat/i.test(t);
  let stable = true;
  for (let i = 0; i < 8; i++) if (sh('node --test 2>&1').status !== 0) stable = false;
  return { pass: returnsPromise && awaited && sleeps === 0 && !retries && stable, notes: `returnsPromise=${returnsPromise} awaited=${awaited} sleepsLeft=${sleeps} retries=${retries} stable=${stable}` };
};
