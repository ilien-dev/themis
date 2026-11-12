import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRules } from './extract.ts';
import { readFacts, type Facts } from './facts.ts';
import { contextFor, judgeAll, type Context } from './verdict.ts';
import type { Rule, Verdict, VerdictKind } from './types.ts';

// A labelled rule of the regression corpus, one JSON object per line of a .jsonl file.
export interface Case {
  readonly id: string;
  readonly repo: string; // directory relative to the corpus base, copied to a fresh git repo
  readonly file: string; // where the rule would live, relative to the repo
  readonly rule: string; // markdown that parses to exactly one rule
  readonly expect: VerdictKind;
  readonly code?: string; // required unless `expect` is keep
  readonly line?: number; // the rule's line in its file; 1 when absent
  readonly gap?: string; // a redundant rule the gate keeps: why it is really redundant
}

const KINDS = new Set<string>(['keep', 'cut', 'move', 'rewrite', 'fix', 'conflict']);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v !== '';

// The cases of a corpus; throws with the line number of the first invalid one.
export function parseCorpus(text: string): Case[] {
  const out: Case[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    if (raw.trim() === '') continue;
    const fail = (why: string): never => { throw new Error(`corpus line ${i + 1}: ${why}`); };
    let v: unknown;
    try { v = JSON.parse(raw); } catch { fail('not JSON'); }
    if (!isObject(v)) return fail('not an object');
    const { id, repo, file, rule, expect, code, line, gap } = v;
    if (!str(id) || !str(repo) || !str(file) || !str(rule)) fail('id, repo, file and rule must be strings');
    if (typeof expect !== 'string' || !KINDS.has(expect)) fail('expect is not a verdict');
    if (code !== undefined && !str(code)) fail('code must be a string');
    if (expect !== 'keep' && code === undefined) fail('code is required unless expect is keep');
    if (line !== undefined && (typeof line !== 'number' || !Number.isInteger(line) || line < 1)) fail('line must be a positive integer');
    if (gap !== undefined && (!str(gap) || expect !== 'keep')) fail('gap is a reason, only on keep');
    if (ids.has(id as string)) fail(`duplicate id ${String(id)}`);
    ids.add(id as string);
    out.push(v as unknown as Case);
  }
  return out;
}

// The one rule a case holds, at the line it gives.
export function caseRule(c: Case): Rule {
  const rules = parseRules(c.rule);
  const rule = rules[0];
  if (rules.length !== 1 || rule === undefined) throw new Error(`case ${c.id}: the text parses to ${rules.length} rules`);
  return c.line === undefined ? rule : { ...rule, line: c.line };
}

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(join(from, e.name), join(to, e.name));
    else if (e.isFile()) copyFileSync(join(from, e.name), join(to, e.name));
  }
}

// Judges cases against copies of their repos. Each repo is copied and initialised once, and each
// rule file's facts read once. Call `dispose` to remove the copies.
export class CorpusRunner {
  private readonly copies = new Map<string, string>();
  private readonly facts = new Map<string, { facts: Facts; ctx: Context }>();
  private readonly base: string;

  constructor(base: string) { this.base = base; }

  // The copy of `repo` as a fresh git repository with nothing committed.
  dirFor(repo: string): string {
    let dir = this.copies.get(repo);
    if (dir === undefined) {
      dir = realpathSync(mkdtempSync(join(tmpdir(), 'themis-corpus-')));
      copyDir(join(this.base, repo), dir);
      spawnSync('git', ['init', '-q'], { cwd: dir, windowsHide: true });
      this.copies.set(repo, dir);
    }
    return dir;
  }

  factsFor(c: Case): { facts: Facts; ctx: Context } {
    const key = `${c.repo}\0${c.file}`;
    const known = this.facts.get(key);
    if (known !== undefined) return known;
    const facts = readFacts(join(this.dirFor(c.repo), c.file));
    const entry = { facts, ctx: contextFor(facts) };
    this.facts.set(key, entry);
    return entry;
  }

  run(c: Case): Verdict {
    const { facts, ctx } = this.factsFor(c);
    const [v] = judgeAll([caseRule(c)], facts, ctx);
    if (v === undefined) throw new Error(`case ${c.id}: no verdict`);
    return v;
  }

  dispose(): void {
    for (const dir of this.copies.values()) rmSync(dir, { recursive: true, force: true });
    this.copies.clear();
    this.facts.clear();
  }
}

// Does the gate give the case its label? A gap case may only be kept.
export const matches = (c: Case, v: Verdict): boolean =>
  v.verdict === c.expect && (c.expect === 'keep' || v.code === c.code);
