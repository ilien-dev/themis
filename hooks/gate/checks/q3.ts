import { NEGATION } from '../tables/alias.ts';
import { PHRASES, type Phrase } from '../tables/phrases.ts';
import { ABSOLUTE, citedPaths, onlyConnectives, spans } from '../text.ts';
import type { Answer, Rule } from '../types.ts';
import type { Check } from '../verdict.ts';

// Question 3: is this rule generic advice, file filler or something the vendor says to remove?

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
// What may remain once the phrases are removed. Anything else is information.
const CONNECTIVES = new Set([
  'and', 'or', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'this', 'our', 'your', 'please',
  'y', 'o', 'el', 'la', 'en', 'de', 'para', 'por', 'favor',
]);
const CODES = { vendor: 'vendor-declared', filler: 'file-filler', generic: 'generic-advice' } as const;
const ORDER: readonly Phrase['group'][] = ['vendor', 'filler', 'generic']; // the most specific reason first

const GLOBAL = new Map<Phrase, RegExp>(PHRASES.map((p) => [p, new RegExp(p.pattern.source, 'giu')]));

export const q3: Check = (rule: Rule) => {
  if (rule.kind === 'heading' || rule.kind === 'code') return null;
  const text = rule.text.replace(LIST_MARKER, '');
  if (spans(text).length > 0 || citedPaths(text).length > 0) return null;

  let rest = text;
  const matched: { phrase: Phrase; text: string }[] = [];
  for (const phrase of PHRASES) {
    const found = rest.match(GLOBAL.get(phrase) ?? phrase.pattern);
    const first = found?.[0];
    if (first === undefined) continue;
    matched.push({ phrase, text: first });
    rest = rest.replace(GLOBAL.get(phrase) ?? phrase.pattern, ' ');
  }
  const best = ORDER.map((g) => matched.find((m) => m.phrase.group === g)).find((m) => m !== undefined);
  if (best === undefined) return null;
  if (ABSOLUTE.test(rest) || NEGATION.test(rest)) return null;
  if (!onlyConnectives(rest, CONNECTIVES)) return null;

  const source = best.phrase.source;
  const quoted = best.text.replace(/\s+/g, ' ').trim();
  const evidence = `phrases: ${best.phrase.group} "${quoted}"${source === undefined ? '' : ` (${source.url})`}`;
  const answer: Answer = { verdict: 'cut', code: CODES[best.phrase.group], question: 3, evidence };
  return answer;
};
