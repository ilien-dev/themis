// Wall-clock budgets are asserted here, in files that run one at a time after the parallel suite,
// so that a busy machine does not fail them.

// One untimed warm-up run (module loading, regex compilation, file caches), then three timed runs.
// Returns the elapsed milliseconds of each timed run; the budget applies to the best of them.
export function timed(run: () => void): number[] {
  run();
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    run();
    runs.push(performance.now() - start);
  }
  return runs;
}

export const best = (runs: readonly number[]): number => Math.min(...runs);
export const show = (runs: readonly number[]): string => runs.map((r) => r.toFixed(0)).join(', ');
