import { readFileSync, existsSync, lstatSync, statSync, realpathSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { dirname, basename, resolve, isAbsolute, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

// One replacement of an Edit, or one entry of a MultiEdit.
export interface EditInput {
  readonly old_string: string | undefined;
  readonly new_string: string | undefined;
  readonly replace_all: boolean;
}

export interface ToolInput extends EditInput {
  readonly file_path: string | undefined;
  readonly command: string;
  readonly content: string | undefined; // Write
  readonly edits: readonly EditInput[] | undefined; // MultiEdit
}

// The part of a hook payload themis reads. A field of the wrong type counts as absent.
export interface HookInput {
  readonly hook_event_name: string | undefined;
  readonly tool_name: string | undefined;
  readonly cwd: string;
  readonly tool_input: ToolInput;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const filled = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

function editInput(v: Record<string, unknown>): EditInput {
  return { old_string: text(v['old_string']), new_string: text(v['new_string']), replace_all: v['replace_all'] === true };
}

export function parseInput(raw: unknown): HookInput {
  const input = isRecord(raw) ? raw : {};
  const ti = isRecord(input['tool_input']) ? input['tool_input'] : {};
  const edits = ti['edits'];
  return {
    hook_event_name: filled(input['hook_event_name']),
    tool_name: filled(input['tool_name']),
    cwd: filled(input['cwd']) ?? process.cwd(),
    tool_input: {
      ...editInput(ti),
      file_path: filled(ti['file_path']),
      command: text(ti['command']) ?? '',
      content: text(ti['content']),
      edits: Array.isArray(edits) ? edits.filter(isRecord).map(editInput) : undefined,
    },
  };
}

// Shared helpers for themis hooks. A hook must fail silent (exit 0, no output) on
// unexpected input so it never blocks a session by accident.
export async function readInput(): Promise<HookInput> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin as AsyncIterable<Buffer>) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
  return parseInput(parsed);
}

export function emit(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj));
}

export async function run(fn: (input: HookInput) => void | Promise<void>): Promise<never> {
  try {
    await fn(await readInput());
  } catch (e) {
    if (process.env['THEMIS_DEBUG']) console.error(e);
  }
  process.exit(0);
}

// Plugin options arrive as CLAUDE_PLUGIN_OPTION_<KEY>.
export function option(key: string, fallback: string): string {
  const v = process.env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`];
  return v === undefined || v === '' ? fallback : v;
}

// Token estimate for English-heavy markdown; no tokenizer is available offline.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

export function read(path: string): string | null {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

// Files a rule file pulls in with @path, resolved; code spans and blocks do not import.
export function imports(file: string, text: string): string[] {
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  return [...body.matchAll(/(?:^|\s)@([^\s]+)/g)].map((m) => {
    const p = (m[1] ?? '').replace(/^~(?=[\\/])/, homedir());
    return isAbsolute(p) ? p : resolve(dirname(file), p);
  });
}

// Parity: CLAUDE.md and AGENTS.md in one directory hold the same bytes.
export const RULE_FILE = /^(CLAUDE(\.local)?|AGENTS)\.md$/i;
export const SHELL_RULE_FILE = /(CLAUDE(\.local)?|AGENTS)\.md/i;
const TWIN: Readonly<Record<string, string>> = { 'claude.md': 'AGENTS.md', 'agents.md': 'CLAUDE.md' };
const same = (a: string, b: string): boolean => resolve(a).toLowerCase() === resolve(b).toLowerCase();

// A shell command that writes to a rule file: a redirect, tee, sed/perl -i or a PowerShell
// cmdlet whose target is one. A ">" aimed elsewhere (2>&1, > out.txt, =>) does not count.
const RULE_PATH = String.raw`["']?(?:[^\s"'|;&<>]*[\\/])?(?:CLAUDE(?:\.local)?|AGENTS)\.md\b`;
const PS_WRITE = String.raw`\b(?:Set-Content|Add-Content|Out-File)\b`;
const SHELL_WRITE = new RegExp([
  String.raw`(?<![=-])>>?\s*${RULE_PATH}`,
  String.raw`\btee\b[^|;&]*\s${RULE_PATH}`,
  String.raw`\b(?:sed|perl)\s+-i[\s\S]*\s${RULE_PATH}`,
  String.raw`${PS_WRITE}\s+${RULE_PATH}`,
  String.raw`${PS_WRITE}[^|;]*\s-(?:Path|FilePath|LiteralPath)\s+${RULE_PATH}`,
].join('|'), 'i');
export const writesRuleFile = (cmd: string): boolean => SHELL_WRITE.test(cmd);

// The user's ~/.claude and the managed-policy directories are Claude Code's own: no AGENTS.md there.
const OWN_DIRS = [join(homedir(), '.claude'), '/Library/Application Support/ClaudeCode', '/etc/claude-code',
  join(process.env['ProgramFiles'] || 'C:\\Program Files', 'ClaudeCode')];
function paired(dir: string): boolean {
  return !/^(false|0|no|off)$/i.test(option('parity', 'true')) && !OWN_DIRS.some((d) => same(dir, d));
}

// The file that must match this one, or null (CLAUDE.local.md and other files have none).
export function twinOf(file: string): string | null {
  const name = TWIN[basename(file).toLowerCase()];
  return name && paired(dirname(file)) ? join(dirname(file), name) : null;
}

// same | differ | missing (one of the two) | none | symlink | import (one pulls in the other)
export type PairState = 'same' | 'differ' | 'missing' | 'none' | 'symlink' | 'import';

export function pairState(a: string, b: string): PairState {
  const [ea, eb] = [existsSync(a), existsSync(b)];
  if (!ea && !eb) return 'none';
  if (ea !== eb) return 'missing';
  if (lstatSync(a).isSymbolicLink() || lstatSync(b).isSymbolicLink() || same(realpathSync(a), realpathSync(b))) return 'symlink';
  const [ba, bb] = [readFileSync(a), readFileSync(b)];
  if (ba.equals(bb)) return 'same';
  const pulls = (from: string, buf: Buffer, to: string): boolean => imports(from, buf.toString('utf8')).some((p) => same(p, to));
  return pulls(a, ba, b) || pulls(b, bb, a) ? 'import' : 'differ';
}

function gitLines(cwd: string, args: readonly string[]): string[] | null {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000, windowsHide: true });
  return r.status === 0 ? r.stdout.split(/[\0\n]/).filter(Boolean) : null;
}

// Directories that may hold a pair: the ones Claude Code loads at launch (the working directory up
// to the repo root, and their .claude/) and the ones below it that it loads on demand.
function ruleDirs(cwd: string): string[] {
  const dirs = new Set<string>();
  const add = (d: string): void => { dirs.add(d); dirs.add(join(d, '.claude')); };
  const top = gitLines(cwd, ['rev-parse', '--show-toplevel'])?.[0];
  if (top) for (let d = cwd; ; d = dirname(d)) { add(d); if (same(d, top) || d === dirname(d)) break; }
  const listed = top ? gitLines(cwd, ['ls-files', '-z', '-co', '--exclude-standard', '--', '*CLAUDE.md', '*AGENTS.md']) : null;
  if (listed) for (const f of listed) add(dirname(resolve(cwd, f)));
  else {
    // Not a git repo: a bounded walk that skips dot directories and node_modules.
    const queue: [string, number][] = [[cwd, 0]];
    for (let n = 0; n < 2000; n++) {
      const item = queue.shift();
      if (!item) break;
      const [d, depth] = item;
      add(d);
      if (depth === 4) continue;
      let entries: Dirent[] = [];
      try { entries = readdirSync(d, { withFileTypes: true }); } catch { /* unreadable */ }
      for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') queue.push([join(d, e.name), depth + 1]);
    }
  }
  return [...dirs];
}

// One line per pair that is not two identical files; paths are relative to cwd when below it.
export function parityProblems(cwd: string): string[] {
  const rel = (p: string): string => (relative(cwd, p).startsWith('..') ? p : relative(cwd, p)).replace(/\\/g, '/');
  const when = (p: string): string => statSync(p).mtime.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const out: string[] = [];
  for (const dir of ruleDirs(cwd).sort()) {
    if (!paired(dir)) continue;
    const [c, a] = [join(dir, 'CLAUDE.md'), join(dir, 'AGENTS.md')];
    const state = pairState(c, a);
    if (state === 'differ') out.push(`differ: ${rel(c)} (modified ${when(c)}) and ${rel(a)} (modified ${when(a)})`);
    else if (state === 'missing') { const [has, lacks] = existsSync(c) ? [c, a] : [a, c]; out.push(`incomplete: ${rel(has)} exists, ${rel(lacks)} does not`); }
    else if (state === 'import' || state === 'symlink') out.push(`linked by ${state}, not two copies: ${rel(c)} and ${rel(a)}`);
  }
  return out;
}

export function parityNotice(problems: readonly string[]): string {
  return 'themis keeps CLAUDE.md and AGENTS.md in the same directory identical, and these are not:\n' +
    problems.map((p) => `- ${p}`).join('\n') +
    '\nTell the user which files these are. Where two files differ, do not pick a version yourself: ask the user which text is right. ' +
    'Load the themis:themis skill and follow its sync section to resolve any of these.';
}
