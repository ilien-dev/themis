import { q1 } from "./checks/q1.js";
import { q2 } from "./checks/q2.js";
import { q3 } from "./checks/q3.js";
import { ABSOLUTE, citedPaths, citedScripts, hasAnchor, hasReason, mentions, ruleHash, spans } from "./text.js";
export const CHECKS = [{ question: 1, run: q1 }, { question: 2, run: q2 }, { question: 3, run: q3 }];
const OUTSIDE_REPO = new Set([3, 7]);
function mentionsKnownThing(rule, facts, ctx) {
    const text = rule.text;
    if (ctx.techNames.some((t) => mentions(text, t)))
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
        if (a !== null)
            return { rule, verdict: a.verdict, code: a.code, question: a.question, evidence: a.evidence, notes: [] };
    }
    return { rule, verdict: 'keep', code: null, question: null, evidence: '', notes: notesFor(rule, facts, ctx) };
}
export function judgeAll(rules, facts, ctx) {
    return rules.map((r) => judge(r, facts, ctx));
}
export const interrupts = (v) => v.verdict !== 'keep';
