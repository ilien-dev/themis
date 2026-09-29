export default async ({ sh, final }) => {
  const src = sh('cat invoice.js').stdout;
  const reused = /formatDate/.test(src) && /utils\/dates/.test(src) && !/toISOString|toLocaleDateString|getUTCMonth|getMonth/.test(src);
  const countUntouched = /inv\.lines\.length - 1/.test(src);
  const mentioned = /(line count|count|length - 1|off[- ]by[- ]one|one (fewer|less)|lines\.length)/i.test(final);
  return { pass: reused && countUntouched && mentioned, notes: `reused=${reused} countUntouched=${countUntouched} mentioned=${mentioned}` };
};
