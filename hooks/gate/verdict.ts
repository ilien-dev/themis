import { q1 } from './checks/q1.ts';
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

export interface Context {
  readonly accepted: ReadonlyMap<string, Answer>;
  readonly techNames: readonly string[];
}

// Every spelling of every technology the alias table knows; one array so compiled matchers are reused.
const TECH_NAMES: readonly string[] = TECH.flatMap((t) => [t.name, ...t.aliases]);

// The context of a judgement in the repository of `facts`: the rules its user accepted and the known names.
export function contextFor(facts: Facts): Context {
  return { accepted: loadAccepted(facts.root), techNames: TECH_NAMES };
}

export type Check = (rule: Rule, facts: Facts) => Answer | null;

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
    const a = check.run(rule, facts);
    if (a !== null) {
      const v: Verdict = { rule, verdict: a.verdict, code: a.code, question: a.question, evidence: a.evidence, notes: [] };
      return a.target === undefined ? v : { ...v, target: a.target };
    }
  }
  return { rule, verdict: 'keep', code: null, question: null, evidence: '', notes: notesFor(rule, facts, ctx) };
}

export function judgeAll(rules: readonly Rule[], facts: Facts, ctx: Context): Verdict[] {
  return rules.map((r) => judge(r, facts, ctx));
}

export const interrupts = (v: Verdict): boolean => v.verdict !== 'keep';
