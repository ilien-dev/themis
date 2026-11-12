// PreToolUse: keep every CLAUDE.md / CLAUDE.local.md / AGENTS.md under a token cap, imports included,
// and refuse an edit that would hide a difference between CLAUDE.md and AGENTS.md.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { run, emit, option, gatePaths, estimateTokens, read, imports, RULE_FILE, writesRuleFile, twinOf, pairState } from './lib.ts';
import type { HookInput, ToolInput } from './lib.ts';
import { newRules } from './gate/extract.ts';
import { readFacts } from './gate/facts.ts';
import { formatAsk, formatNotes } from './gate/format.ts';
import { clearPending, pendingKey, writePending } from './gate/accepted.ts';
import { ruleHash } from './gate/text.ts';
import { contextFor, interrupts, judgeAll } from './gate/verdict.ts';

function decide(permissionDecision: 'deny' | 'ask', reason: string): true {
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason: reason } });
  return true;
}
const deny = (reason: string): true => decide('deny', reason);

function applyEdits(file: string, input: ToolInput): string {
  if (input.content !== undefined) return input.content; // Write
  let text = read(file) ?? '';
  for (const e of input.edits ?? [input]) {
    if (e.old_string === undefined) continue;
    const next = e.new_string ?? '';
    text = e.replace_all ? text.split(e.old_string).join(next) : text.replace(e.old_string, () => next);
  }
  return text;
}

function importTokens(file: string, text: string): number {
  let total = 0;
  for (const p of imports(file, text)) {
    const t = existsSync(p) && statSync(p).isFile() ? read(p) : null;
    if (t) total += estimateTokens(t);
  }
  return total;
}

function checkCap(file: string, toolInput: ToolInput): boolean {
  const cap = Number(option('claude_md_cap', '2500'));
  if (!cap) return false;
  const next = applyEdits(file, toolInput);
  const own = estimateTokens(next);
  const imported = importTokens(file, next);
  const total = own + imported;
  if (total <= cap) return false;
  const before = read(file);
  if (before !== null && total < estimateTokens(before) + importTokens(file, before)) return false; // shrinking is allowed
  return deny(`${basename(file)} would be ~${total} tokens (${own} own + ${imported} imported); the cap is ${cap}. ` +
    'Make room instead of growing it: merge or drop lines the model would follow anyway, or move procedures into a skill or doc referenced by path. ' +
    'Load the themis:themis skill and follow its edit section.');
}

// The copy that follows an edit (parity.ts) is only safe when the two files matched before it.
function checkParity(file: string, tool: string | undefined, toolInput: ToolInput): boolean {
  const twin = twinOf(file);
  if (!twin) return false;
  const [name, other] = [basename(file), basename(twin)];
  const state = pairState(file, twin);
  if (state === 'missing' && !existsSync(file) && !Buffer.from(applyEdits(file, toolInput)).equals(readFileSync(twin))) {
    return deny(`${other} exists next to it and the two must be identical, so ${name} can only be created as an exact copy of ${other}. ` +
      `To change the rules, edit ${other}: themis copies every edit to the other file.`);
  }
  if (state !== 'differ') return false;
  const differ = `${name} and ${other} in this directory are meant to be identical and already differ, by a change themis did not make.`;
  if (tool === 'Write') {
    return decide('ask', `${differ} Writing ${name} replaces both files with this text and discards whatever only ${other} has. Approve only if this is the text you want in both.`);
  }
  return deny(`${differ} Do not pick a version yourself: show the user how they differ and ask which text is right ` +
    '(load the themis:themis skill, sync section). Then Write the agreed full text to one of them; themis copies it to the other.');
}

// Hook input fields checked against https://code.claude.com/docs/en/hooks on 2026-11-12: `session_id` and
// `permission_mode` are common to every event; `agent_id` is present when the hook fires inside a subagent.
// Nothing marks a headless (-p) session; there Claude Code denies an `ask` nobody can answer and Claude reads
// the reason, which is why the modes below that cannot prompt fall back to reporting.
function effectiveMode(input: HookInput): 'ask' | 'report' | 'off' {
  const mode = option('gate', 'report').toLowerCase();
  if (mode === 'off') return 'off';
  const cannotPrompt = input.permission_mode === 'dontAsk' || input.permission_mode === 'bypassPermissions' || input.agent_id !== undefined;
  return mode === 'ask' && !cannotPrompt ? 'ask' : 'report';
}

function checkGate(input: HookInput, file: string): void {
  const mode = effectiveMode(input);
  if (mode === 'off') return;
  const added = newRules(read(file), applyEdits(file, input.tool_input));
  if (added.length === 0) return;
  const facts = readFacts(file);
  const verdicts = judgeAll(added, facts, contextFor(facts, { paths: gatePaths() }));
  const name = basename(file);
  const flagged = verdicts.filter(interrupts);
  if (flagged.length === 0) {
    const notes = formatNotes(verdicts);
    if (notes) emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: notes } });
    return;
  }
  if (mode === 'ask') {
    // Only an ask of the gate leaves something for PostToolUse to record. The message is built first, so
    // nothing is left pending if building it fails and no prompt is shown.
    const message = formatAsk(verdicts, name, 'ask');
    writePending(pendingKey(input.session_id ?? '', file), flagged.map((v) => ruleHash(v.rule.text)));
    decide('ask', message);
    return;
  }
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: formatAsk(verdicts, name, 'report') } });
}

await run((input) => {
  const ti = input.tool_input;
  const cwd = input.cwd;
  if (input.tool_name === 'Bash' || input.tool_name === 'PowerShell') {
    if (writesRuleFile(ti.command)) {
      deny('CLAUDE.md and AGENTS.md have a size cap and are kept identical, both checked on Edit and Write. Edit them with those tools instead of the shell.');
    }
    return;
  }
  if (!ti.file_path || !RULE_FILE.test(basename(ti.file_path))) return;
  const file = resolve(cwd, ti.file_path);
  // An approval pending from an earlier call (a denied ask) must not be recorded for this one, whatever
  // decides it: the cap, parity, the gate off or in report mode, or no new rule at all.
  clearPending(pendingKey(input.session_id ?? '', file));
  if (checkCap(file, ti) || checkParity(file, input.tool_name, ti)) return;
  try { checkGate(input, file); } catch (e) { if (process.env['THEMIS_DEBUG']) console.error(e); } // the gate never gets in the way
});
