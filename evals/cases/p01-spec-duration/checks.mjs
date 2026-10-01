// Hidden behavior checks, one per spec detail. Returns { passed, total, failed[] }.
export function runChecks(formatDuration) {
  const cases = [];
  const eq = (name, fn, want) => cases.push([name, () => { const got = fn(); if (got !== want) throw new Error(`got ${JSON.stringify(got)}`); }]);
  const throws = (name, fn, type, msg) => cases.push([name, () => {
    try { fn(); } catch (e) { if (!(e instanceof type) || e.message !== msg) throw new Error(`threw ${e.name}: ${e.message}`); return; }
    throw new Error('did not throw');
  }]);
  const F = formatDuration;
  throws('r1 string', () => F('5'), TypeError, 'formatDuration: ms must be a finite number');
  throws('r1 NaN', () => F(NaN), TypeError, 'formatDuration: ms must be a finite number');
  throws('r1 Infinity', () => F(Infinity), TypeError, 'formatDuration: ms must be a finite number');
  eq('r3 all units', () => F(90061001), '1d 1h 1m 1s 1ms');
  eq('r4 skip middle zeros', () => F(3600001), '1h 1ms');
  eq('r4 days and seconds', () => F(86401000), '1d 1s');
  eq('r5 zero', () => F(0), '0ms');
  eq('r6 negative', () => F(-61000), '-1m 1s');
  eq('r6 negative zero', () => F(-0), '0ms');
  eq('r7 round up', () => F(1.5), '2ms');
  eq('r7 round negative away from zero', () => F(-1.5), '-2ms');
  eq('r7 round down', () => F(0.4), '0ms');
  eq('r7 tiny negative rounds to zero', () => F(-0.4), '0ms');
  eq('r8 maxUnits round up', () => F(5_430_000, { maxUnits: 1 }), '2h');
  eq('r8 maxUnits round down', () => F(5_370_000, { maxUnits: 1 }), '1h');
  eq('r8 maxUnits 2', () => F(90061001, { maxUnits: 2 }), '1d 1h');
  eq('r8 maxUnits larger than units', () => F(61000, { maxUnits: 5 }), '1m 1s');
  eq('r9 carry to days', () => F(86_399_999, { maxUnits: 2 }), '1d');
  eq('r9 carry minutes to hour', () => F(3_599_600, { maxUnits: 2 }), '1h');
  eq('r10 long mixed', () => F(3_661_000, { long: true }), '1 hour, 1 minute, 1 second');
  eq('r10 long plural', () => F(7_200_000, { long: true }), '2 hours');
  eq('r10 long zero', () => F(0, { long: true }), '0 milliseconds');
  eq('r10 long negative', () => F(-2000, { long: true }), '-2 seconds');
  eq('r10 long with maxUnits', () => F(5_430_000, { long: true, maxUnits: 1 }), '2 hours');
  throws('r11 maxUnits zero', () => F(1000, { maxUnits: 0 }), RangeError, 'formatDuration: maxUnits must be a positive integer');
  throws('r11 maxUnits fraction', () => F(1000, { maxUnits: 1.5 }), RangeError, 'formatDuration: maxUnits must be a positive integer');
  throws('r12 unknown option', () => F(1000, { compact: true, verbose: 1 }), TypeError, 'formatDuration: unknown option "compact"');
  cases.push(['r13 no mutation', () => { const o = Object.freeze({ maxUnits: 1, long: true }); F(5_430_000, o); }]);
  const failed = [];
  for (const [name, fn] of cases) { try { fn(); } catch (e) { failed.push(`${name}: ${e.message}`); } }
  return { passed: cases.length - failed.length, total: cases.length, failed };
}
