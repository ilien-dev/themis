// PreToolUse: keep every CLAUDE.md / CLAUDE.local.md / AGENTS.md under a token cap, imports included,
// and refuse an edit that would hide a difference between CLAUDE.md and AGENTS.md.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { run, emit, option, estimateTokens, read, imports, RULE_FILE, writesRuleFile, twinOf, pairState } from './lib.ts';
import type { ToolInput } from './lib.ts';

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
  if (!checkCap(file, ti)) checkParity(file, input.tool_name, ti);
});
