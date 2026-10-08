#!/usr/bin/env node
// Headless A/B runner. Each run: copy a case fixture into a temp git repo, run
// `claude -p` in one arm, parse the stream-json transcript, grade it.
//
//   node evals/run.ts --case c15-* --arms base,themis --runs 3 -j 3 [--tag name]
//
// Arms: base = no plugin; themis = --plugin-dir <repo>. User settings, hooks and plugins are excluded in every arm
// (--setting-sources project,local); each fixture carries its own .claude/settings.json.
import { spawn, spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CaseMeta, Grade, Grader, ParsedRun, RunRecord, StreamEvent, Turn } from './types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = join(ROOT, 'evals', 'cases');

const args = process.argv.slice(2);
const opt = (k: string, d: string): string => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1] ?? d; };
const pattern = new RegExp('^' + opt('--case', '*').split(',').map((g) => g.replace(/\*/g, '.*')).join('$|^') + '$');
const arms = opt('--arms', 'base,themis').split(',');
const runs = Number(opt('--runs', '3'));
const conc = Number(opt('-j', '3'));
const real = args.includes('--real'); // keep the user's own settings, hooks and plugins
const tag = opt('--tag', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const outDir = join(ROOT, 'evals', 'results', tag);

function sh(cmd: string, cwd: string): SpawnSyncReturns<string> {
  return spawnSync(cmd, { cwd, shell: 'bash', encoding: 'utf8' });
}

function prepare(caseDir: string, meta: CaseMeta, label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `themis-${label}-`));
  if (existsSync(join(caseDir, 'fixture'))) cpSync(join(caseDir, 'fixture'), dir, { recursive: true });
  mkdirSync(join(dir, '.claude'), { recursive: true });
  const settings = join(dir, '.claude', 'settings.json');
  if (!existsSync(settings) && !real) writeFileSync(settings, JSON.stringify({ language: meta.language || 'English' }));
  sh('git init -q -b main && git -c core.autocrlf=false add -A && git -c user.name=t -c user.email=t@t commit -qm init', dir);
  // worktree/ holds uncommitted changes laid over the initial commit.
  if (existsSync(join(caseDir, 'worktree'))) cpSync(join(caseDir, 'worktree'), dir, { recursive: true });
  if (meta.setup) sh(meta.setup, dir);
  return dir;
}

function parse(jsonl: string): ParsedRun {
  const run: ParsedRun = { tools: [], denials: [], hooks: [], result: null, init: null };
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let e: StreamEvent; try { e = JSON.parse(line) as StreamEvent; } catch { continue; }
    if (e.type === 'system' && e.subtype === 'init') run.init = e;
    if (e.type === 'system' && e.subtype === 'hook_response') run.hooks.push({ name: e.hook_name ?? '', output: e.output });
    if (e.type === 'assistant') for (const c of e.message?.content ?? []) if (c.type === 'tool_use') run.tools.push({ name: c.name ?? '', input: c.input, sub: !!e.parent_tool_use_id });
    if (e.type === 'result') { run.result = e; run.denials.push(...(e.permission_denials ?? [])); }
  }
  return run;
}

interface Exit { out: string; err: string; code: number | null }

function claude(dir: string, meta: CaseMeta, arm: string, prompt: string, session: string[] | null): Promise<Exit> {
  const a = ['-p', prompt, '--model', 'claude-opus-5-5', '--effort', meta.effort || 'medium',
    '--output-format', 'stream-json', '--verbose', '--include-hook-events',
    ...(session ?? ['--no-session-persistence']),
    ...(real ? [] : ['--setting-sources', 'project,local']), '--permission-mode', 'dontAsk',
    '--allowedTools', meta.allowedTools || 'Read Edit Write Glob Grep Bash PowerShell Agent Skill',
    '--max-turns', String(meta.maxTurns ?? 30)];
  if (arm === 'themis' || arm.startsWith('themis')) a.push('--plugin-dir', ROOT);
  const env = { ...process.env };
  delete env['CLAUDE_CODE_EFFORT_LEVEL'];
  return new Promise<Exit>((res) => {
    const p = spawn('claude', a, { cwd: dir, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => p.kill(), (meta.timeoutSec ?? 900) * 1000);
    p.stdout.on('data', (d: Buffer) => (out += d.toString()));
    p.stderr.on('data', (d: Buffer) => (err += d.toString()));
    p.on('close', (code) => { clearTimeout(timer); res({ out, err, code }); });
  });
}

async function one(name: string, arm: string, i: number): Promise<RunRecord> {
  const done = join(outDir, name, `${arm}-${i}.json`);
  if (existsSync(done)) { const r = JSON.parse(readFileSync(done, 'utf8')) as RunRecord; if (!r.invalid && r.pass !== null) return r; }
  const caseDir = join(CASES, name);
  const meta = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8')) as CaseMeta;
  const dir = prepare(caseDir, meta, `${name}-${arm}-${i}`);
  const t0 = Date.now();
  // Multi-turn cases: meta.turns lists earlier user turns; the case prompt is the last one.
  const pick = (m: Turn): string => (arm !== 'themis' && !arm.startsWith('themis') && m.basePrompt ? m.basePrompt : m.prompt);
  const turns: Turn[] = [...(meta.turns ?? []), meta];
  const sid = randomUUID();
  let out = '', err = '', code: number | null = 0;
  for (const [k, turn] of turns.entries()) {
    const session = turns.length === 1 ? null : k === 0 ? ['--session-id', sid] : ['--resume', sid];
    ({ out, err, code } = await claude(dir, meta, arm, pick(turn), session));
  }
  const run = parse(out);
  const r = run.result;
  const invalid = !r || r.is_error || r.subtype !== 'success' ? (r?.subtype || `exit ${String(code)}: ${err.slice(0, 200)}`) : null;
  let grade: Grade = { pass: null, notes: 'invalid run' };
  if (r && !invalid) {
    const diff = sh('git -c core.autocrlf=false add -A && git -c core.autocrlf=false diff --cached HEAD', dir).stdout;
    try { const g = await import(pathToFileURL(join(caseDir, 'grade.ts')).href) as { default: Grader }; grade = await g.default({ dir, run, final: r.result || '', diff, sh: (c) => sh(c, dir), arm }); }
    catch (e) { grade = { pass: null, notes: 'grader error: ' + (e instanceof Error ? e.message : String(e)) }; }
  }
  const rec: RunRecord = { case: name, arm, i, dir, invalid, ...grade, cost: r?.total_cost_usd ?? null, turns: r?.num_turns ?? null,
    outTokens: r?.usage?.output_tokens ?? null, secs: Math.round((Date.now() - t0) / 1000),
    tools: run.tools.map((t) => t.name + (t.sub ? '*' : '')).join(','), denials: run.denials.length };
  mkdirSync(join(outDir, name), { recursive: true });
  writeFileSync(join(outDir, name, `${arm}-${i}.jsonl`), out);
  writeFileSync(join(outDir, name, `${arm}-${i}.json`), JSON.stringify({ ...rec, final: r?.result }, null, 2));
  console.log(`${name} ${arm}#${i} ${invalid ? 'INVALID ' + invalid : rec.pass ? 'PASS' : rec.pass === false ? 'FAIL' : '??'} $${(rec.cost ?? 0).toFixed(3)} ${rec.secs}s ${grade.notes || ''}`);
  return rec;
}

const names = readdirSync(CASES).filter((n) => pattern.test(n)).sort();
const jobs: [string, string, number][] = [];
for (const n of names) for (const arm of arms) for (let i = 1; i <= runs; i++) jobs.push([n, arm, i]);
const results: RunRecord[] = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(conc, jobs.length) }, async () => {
  for (let j = jobs[next++]; j; j = jobs[next++]) results.push(await one(...j));
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
console.log('\ncase                          arm       pass/valid   cost');
for (const n of names) for (const arm of arms) {
  const rs = results.filter((r) => r.case === n && r.arm === arm);
  const valid = rs.filter((r) => !r.invalid && r.pass !== null);
  const cost = rs.reduce((s, r) => s + (r.cost ?? 0), 0);
  console.log(`${n.padEnd(30)}${arm.padEnd(10)}${`${valid.filter((r) => r.pass).length}/${valid.length}`.padEnd(13)}$${cost.toFixed(2)}`);
}
console.log('total $' + results.reduce((s, r) => s + (r.cost ?? 0), 0).toFixed(2), '→', outDir);
