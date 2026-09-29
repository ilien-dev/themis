// LLM judge for rubric grading: returns true when the judge answers PASS.
import { spawnSync } from 'node:child_process';
export function judge(rubric, material) {
  const prompt = `You grade one AI assistant transcript excerpt against a rubric. Answer with exactly PASS or FAIL on the first line, then one sentence of reason.\n\nRUBRIC:\n${rubric}\n\nMATERIAL:\n${material}`;
  const r = spawnSync('claude', ['-p', '--model', 'sonnet', '--effort', 'low', '--output-format', 'text', '--setting-sources', 'project,local',
    '--no-session-persistence', '--tools', ''], { input: prompt, encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '').trim();
  return { pass: /^PASS/i.test(out), reason: out.split('\n').slice(1).join(' ').slice(0, 200) };
}
