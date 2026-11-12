import { similarity } from "../text.js";
// Question 6: is this passage long enough, or copied from a doc, to live somewhere else?
const TARGET = 'a skill or a doc, with a one-line pointer';
const MAX_STEPS = 5;
const MAX_LINES = 8;
const FENCE_LINE = /^\s*(?:`{3,}|~{3,})/;
const long = (evidence) => ({ verdict: 'move', code: 'long-procedure', question: 6, evidence, target: TARGET });
export const q6 = (rule, facts) => {
    if (rule.kind === 'heading')
        return null;
    if (rule.lines >= 3) {
        for (const doc of facts.docs) {
            if (similarity(rule.text, doc.text) > 0.8) {
                const a = { verdict: 'move', code: 'duplicated-passage', question: 6, evidence: `similar to ${doc.file}`, target: doc.file };
                return a;
            }
        }
    }
    const steps = rule.kind === 'steps' ? rule.text.split('\n').filter((l) => /^\d+[.)]\s/.test(l)).length : 0;
    if (steps > MAX_STEPS)
        return long(`${steps} steps`);
    // What a reader reads: fences and blank lines do not make a block longer.
    const lines = rule.text.split('\n').filter((l) => l.trim() !== '' && !FENCE_LINE.test(l)).length;
    if (lines > MAX_LINES)
        return long(`${lines} lines`);
    return null;
};
