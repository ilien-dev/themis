import { NEGATION } from "../tables/alias.js";
import { PHRASES } from "../tables/phrases.js";
import { ABSOLUTE, citedPaths, onlyConnectives, spans } from "../text.js";
// Question 3: is this rule generic advice, file filler or something the vendor says to remove?
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
// What may remain once the phrases are removed. Anything else is information.
const CONNECTIVES = new Set([
    'and', 'or', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'this', 'our', 'your', 'please',
    'y', 'o', 'el', 'la', 'en', 'de', 'para', 'por', 'favor',
]);
const CODES = { vendor: 'vendor-declared', filler: 'file-filler', generic: 'generic-advice' };
const ORDER = ['vendor', 'filler', 'generic']; // the most specific reason first
const GLOBAL = new Map(PHRASES.map((p) => [p, new RegExp(p.pattern.source, 'giu')]));
export const q3 = (rule) => {
    if (rule.kind === 'heading' || rule.kind === 'code')
        return null;
    const text = rule.text.replace(LIST_MARKER, '');
    if (spans(text).length > 0 || citedPaths(text).length > 0)
        return null;
    let rest = text;
    const matched = [];
    for (const phrase of PHRASES) {
        const found = rest.match(GLOBAL.get(phrase) ?? phrase.pattern);
        const first = found?.[0];
        if (first === undefined)
            continue;
        matched.push({ phrase, text: first });
        rest = rest.replace(GLOBAL.get(phrase) ?? phrase.pattern, ' ');
    }
    const best = ORDER.map((g) => matched.find((m) => m.phrase.group === g)).find((m) => m !== undefined);
    if (best === undefined)
        return null;
    if (ABSOLUTE.test(rest) || NEGATION.test(rest))
        return null;
    if (!onlyConnectives(rest, CONNECTIVES))
        return null;
    const source = best.phrase.source;
    const quoted = best.text.replace(/\s+/g, ' ').trim();
    const evidence = `phrases: ${best.phrase.group} "${quoted}"${source === undefined ? '' : ` (${source.url})`}`;
    const answer = { verdict: 'cut', code: CODES[best.phrase.group], question: 3, evidence };
    return answer;
};
