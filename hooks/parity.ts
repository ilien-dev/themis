// Parity between CLAUDE.md and AGENTS.md in the same directory.
// PostToolUse on Edit/Write/MultiEdit: copy the edited file over its twin (pre-tool.ts only lets
// the edit through when the two matched before it, or the user approved replacing both).
// SessionStart, and PostToolUse on a shell command that names a rule file: report pairs that differ.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { HookInput } from './lib.ts';
import { run, emit, gatePaths, read, RULE_FILE, SHELL_RULE_FILE, twinOf, pairState, parityProblems, parityNotice } from './lib.ts';
import { pendingKey, recordAccepted, takePending } from './gate/accepted.ts';
import { parseRules } from './gate/extract.ts';
import { readFacts } from './gate/facts.ts';
import { ruleHash } from './gate/text.ts';
import { contextFor, judgeAll } from './gate/verdict.ts';

// The user approved an edit that the gate asked about: remember those rules so they are not asked again.
// Only the pending rules that are in the file now count, and only in a repository: outside one there is
// no project to keep `.claude/themis-accepted.json` in.
function recordApproved(input: HookInput, file: string): void {
  const hashes = takePending(pendingKey(input.session_id ?? '', file));
  if (hashes === null) return;
  const facts = readFacts(file);
  if (!facts.inRepo) return;
  const verdicts = judgeAll(parseRules(read(file) ?? ''), facts, contextFor(facts, { paths: gatePaths() })).filter((v) => hashes.includes(ruleHash(v.rule.text)));
  recordAccepted(facts.root, verdicts, new Date().toISOString().slice(0, 10));
}

await run((input) => {
  const event = input.hook_event_name;
  const ti = input.tool_input;
  const cwd = input.cwd;
  const say = (additionalContext: string): void => { emit({ hookSpecificOutput: { hookEventName: event, additionalContext } }); };

  if (event === 'PostToolUse' && ti.file_path) {
    if (!RULE_FILE.test(basename(ti.file_path))) return;
    const file = resolve(cwd, ti.file_path);
    try { recordApproved(input, file); } catch (e) { if (process.env['THEMIS_DEBUG']) console.error(e); }
    const twin = twinOf(file);
    if (!twin || !existsSync(file) || !['differ', 'missing'].includes(pairState(file, twin))) return;
    writeFileSync(twin, readFileSync(file));
    say(`themis copied ${basename(file)} to ${basename(twin)} in the same directory, so the two are identical. Do not edit ${basename(twin)} separately.`);
    return;
  }
  if (event === 'PostToolUse' && !SHELL_RULE_FILE.test(ti.command)) return;
  if (event !== 'PostToolUse' && event !== 'SessionStart') return;
  const problems = parityProblems(cwd);
  if (problems.length) say(parityNotice(problems));
});
