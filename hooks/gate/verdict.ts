import { describedPathCited, q1 } from './checks/q1.ts';
import { q2 } from './checks/q2.ts';
import { q3 } from './checks/q3.ts';
import { q5 } from './checks/q5.ts';
import { q6 } from './checks/q6.ts';
import { q7 } from './checks/q7.ts';
import { loadAccepted } from './accepted.ts';
import { TECH } from './tables/alias.ts';
import { ABSOLUTE, citedPaths, citedScripts, hasAnchor, hasReason, mentionsAny, ruleHash, spans } from './text.ts';
import type { Facts } from './facts.ts';
import type { Answer, Note, Rule, Verdict } from './types.ts';

// What a check may be told besides the rule and the repository. `paths` turns on the described-path detector
// (option gate_paths, CLI --paths); `pathsOverLimit` is set by judgeAll when the rules cite more distinct
// paths than it reads, so the answer never depends on rule order.
export interface CheckOptions {
  readonly paths: boolean;
  readonly pathsOverLimit: boolean;
}

export interface Context {
  readonly accepted: ReadonlyMap<string, Answer>;
  readonly techNames: readonly string[];
  readonly options: CheckOptions;
}

// Every spelling of every technology the alias table knows; one array so compiled matchers are reused.
const TECH_NAMES: readonly string[] = TECH.flatMap((t) => [t.name, ...t.aliases]);

// The context of a judgement in the repository of `facts`: the rules its user accepted and the known names.
export function contextFor(facts: Facts, opts: { readonly paths?: boolean } = {}): Context {
  return { accepted: loadAccepted(facts.root), techNames: TECH_NAMES, options: { paths: opts.paths === true, pathsOverLimit: false } };
}

// A check is a pure function of its arguments: options come in, nothing is read from the environment.
export type Check = (rule: Rule, facts: Facts, options?: CheckOptions) => Answer | null;

// The most distinct paths the described-path detector reads for one set of rules.
export const MAX_CITED_PATHS = 40;

// A check and the question it answers; outside a repo only questions 3 and 7 apply.
export interface RegisteredCheck {
  readonly question: 1 | 2 | 3 | 5 | 6 | 7;
  readonly run: Check;
}

export const CHECKS: readonly RegisteredCheck[] = [{ question: 1, run: q1 }, { question: 2, run: q2 }, { question: 3, run: q3 },
  { question: 5, run: q5 }, { question: 6, run: q6 }, { question: 7, run: q7 }];

const OUTSIDE_REPO = new Set<number>([3, 7]);

function mentionsKnownThing(rule: Rule, facts: Facts, ctx: Context): boolean {
  const text = rule.text;
  if (mentionsAny(text, ctx.techNames)) return true;
  if (citedScripts(text).some((s) => facts.pkg !== null && Object.hasOwn(facts.pkg.scripts, s.script))) return true;
  return citedPaths(text).some((p) => facts.files.has(p));
}

function notesFor(rule: Rule, facts: Facts, ctx: Context): Note[] {
  if (rule.kind === 'heading') return [];
  const notes: Note[] = [];
  if (!mentionsKnownThing(rule, facts, ctx)) notes.push('no-evidence');
  if (!hasAnchor(rule.text, ctx.techNames)) notes.push('no-anchor');
  if (ABSOLUTE.test(rule.text) && spans(rule.text).length === 0 && !hasReason(rule.text)) notes.push('absolute-no-reason');
  return notes;
}

export function judge(rule: Rule, facts: Facts, ctx: Context, checks: readonly RegisteredCheck[] = CHECKS): Verdict {
  const original = ctx.accepted.get(ruleHash(rule.text));
  if (original !== undefined) {
    return { rule, verdict: 'keep', code: null, question: null, evidence: '', notes: ['accepted'], original };
  }
  for (const check of checks) {
    if (!facts.inRepo && !OUTSIDE_REPO.has(check.question)) continue;
    const a = check.run(rule, facts, ctx.options);
    if (a !== null) {
      const v: Verdict = { rule, verdict: a.verdict, code: a.code, question: a.question, evidence: a.evidence, notes: [] };
      return a.target === undefined ? v : { ...v, target: a.target };
    }
  }
  return { rule, verdict: 'keep', code: null, question: null, evidence: '', notes: notesFor(rule, facts, ctx) };
}

export function judgeAll(rules: readonly Rule[], facts: Facts, ctx: Context): Verdict[] {
  let options = ctx.options;
  if (options.paths) {
    const cited = new Set<string>();
    for (const r of rules) { const p = describedPathCited(r); if (p !== null) cited.add(p); }
    if (cited.size > MAX_CITED_PATHS) options = { ...options, pathsOverLimit: true };
  }
  const c = options === ctx.options ? ctx : { ...ctx, options };
  return rules.map((r) => judge(r, facts, c));
}

export const interrupts = (v: Verdict): boolean => v.verdict !== 'keep';
