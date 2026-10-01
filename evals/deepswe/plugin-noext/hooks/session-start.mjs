// SessionStart (startup, resume, clear, compact): inject the resident rule.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, emit } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));

run(async () => {
  // THEMIS_CORE_FILE swaps the text for rule ablation in evals.
  const text = readFileSync(process.env.THEMIS_CORE_FILE || join(here, 'core.txt'), 'utf8').trim();
  if (text) emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } });
});
