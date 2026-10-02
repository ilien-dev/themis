// PreToolUse: keep every CLAUDE.md / CLAUDE.local.md under a token cap, imports included.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, basename, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { run, emit, option, estimateTokens } from './lib.mjs';

const CLAUDE_MD = /^CLAUDE(\.local)?\.md$/i;

function deny(reason) {
  emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function applyEdits(file, input) {
  if (input.content !== undefined) return input.content; // Write
  let text = read(file) ?? '';
  for (const e of input.edits ?? [input]) {
    if (e.old_string === undefined) continue;
    text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

function importTokens(file, text) {
  let total = 0;
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const m of body.matchAll(/(?:^|\s)@([^\s]+)/g)) {
    let p = m[1].replace(/^~(?=[\\/])/, homedir());
    if (!isAbsolute(p)) p = resolve(dirname(file), p);
    const t = existsSync(p) && statSync(p).isFile() ? read(p) : null;
    if (t) total += estimateTokens(t);
  }
  return total;
}

function checkCap(file, toolInput) {
  const cap = Number(option('claude_md_cap', '2500'));
  if (!cap) return;
  const next = applyEdits(file, toolInput);
  const own = estimateTokens(next);
  const imports = importTokens(file, next);
  const total = own + imports;
  if (total <= cap) return;
  const before = read(file);
  if (before !== null && total < estimateTokens(before) + importTokens(file, before)) return; // shrinking is allowed
  deny(`${basename(file)} would be ~${total} tokens (${own} own + ${imports} imported); the cap is ${cap}. ` +
    'Make room instead of growing it: merge or drop lines the model would follow anyway, or move procedures into a skill or doc referenced by path. ' +
    'Load the themis:hestia skill and follow its edit section.');
}

run(async (input) => {
  const ti = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  if (input.tool_name === 'Bash' || input.tool_name === 'PowerShell') {
    const cmd = String(ti.command || '');
    if (/CLAUDE(\.local)?\.md/i.test(cmd) && /(>>?|\btee\b|\b(sed|perl)\s+-i|Set-Content|Add-Content|Out-File)/.test(cmd)) {
      deny('CLAUDE.md has a size cap that is checked on Edit and Write. Edit it with those tools instead of the shell.');
    }
    return;
  }
  if (ti.file_path && CLAUDE_MD.test(basename(ti.file_path))) checkCap(resolve(cwd, ti.file_path), ti);
});
