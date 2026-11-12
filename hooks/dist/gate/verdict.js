import { q1 } from "./checks/q1.js";
import { q2 } from "./checks/q2.js";
import { q3 } from "./checks/q3.js";
import { q5 } from "./checks/q5.js";
import { q6 } from "./checks/q6.js";
import { q7 } from "./checks/q7.js";
import { loadAccepted } from "./accepted.js";
import { TECH } from "./tables/alias.js";
import { ABSOLUTE, citedPaths, citedScripts, hasAnchor, hasReason, mentionsAny, ruleHash, spans } from "./text.js";
// Every spelling of every technology the alias table knows; one array so compiled matchers are reused.
const TECH_NAMES = TECH.flatMap((t) => [t.name, ...t.aliases]);
// The context of a judgement in the repository of `facts`: the rules its user accepted and the known names.
export function contextFor(facts) {
    return { accepted: loadAccepted(facts.root), techNames: TECH_NAMES };
}
export const CHECKS = [{ question: 1, run: q1 }, { question: 2, run: q2 }, { question: 3, run: q3 },
    { question: 5, run: q5 }, { question: 6, run: q6 }, { question: 7, run: q7 }];
const OUTSIDE_REPO = new Set([3, 7]);
function mentionsKnownThing(rule, facts, ctx) {
    const text = rule.text;
    if (mentionsAny(text, ctx.techNames))
        return true;
    if (citedScripts(text).some((s) => facts.pkg !== null && Object.hasOwn(facts.pkg.scripts, s.script)))
        return true;
    return citedPaths(text).some((p) => facts.files.has(p));
}
function notesFor(rule, facts, ctx) {
    if (rule.kind === 'heading')
        return [];
    const notes = [];
    if (!mentionsKnownThing(rule, facts, ctx))
        notes.push('no-evidence');
    if (!hasAnchor(rule.text, ctx.techNames))
        notes.push('no-anchor');
    if (ABSOLUTE.test(rule.text) && spans(rule.text).length === 0 && !hasReason(rule.text))
        notes.push('absolute-no-reason');
    return notes;
}
export function judge(rule, facts, ctx, checks = CHECKS) {
    const original = ctx.accepted.get(ruleHash(rule.text));
    if (original !== undefined) {
        return { rule, verdict: 'keep', code: null, question: null, evidence: '', notes: ['accepted'], original };
    }
    for (const check of checks) {
        if (!facts.inRepo && !OUTSIDE_REPO.has(check.question))
            continue;
        const a = check.run(rule, facts);
        if (a !== null) {
            const v = { rule, verdict: a.verdict, code: a.code, question: a.question, evidence: a.evidence, notes: [] };
            return a.target === undefined ? v : { ...v, target: a.target };
        }
    }
    return { rule, verdict: 'keep', code: null, question: null, evidence: '', notes: notesFor(rule, facts, ctx) };
}
export function judgeAll(rules, facts, ctx) {
    return rules.map((r) => judge(r, facts, ctx));
}
export const interrupts = (v) => v.verdict !== 'keep';
