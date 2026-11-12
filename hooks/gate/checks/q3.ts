import { NEGATION } from '../tables/alias.ts';
import { PHRASES, type Phrase } from '../tables/phrases.ts';
import { ABSOLUTE, citedPaths, onlyConnectives, spans, words } from '../text.ts';
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

// All a level-1 heading may hold to be filler: rule file names and words that only say "instructions".
const TITLE_FILLER = new Set([
  'claude', 'agents', 'agent', 'md', 'gemini', 'copilot', 'codex', 'ai', 'project', 'repository', 'repo', 'codebase', 'instructions',
  'guidance', 'guide', 'guidelines', 'rules', 'context', 'for', 'the', 'this', 'in', 'working', 'with',
  'proyecto', 'repositorio', 'instrucciones', 'guía', 'guia', 'reglas', 'contexto', 'para', 'el', 'la', 'este', 'en', 'del', 'de',
]);

// "# CLAUDE.md", "# AGENTS.md", "# Project instructions": a title that names nothing but the file.
function fillerHeading(rule: Rule): Answer | null {
  const w = words(rule.text.replace(/^#\s+/, ''));
  if (w.length === 0 || /\d/.test(rule.text) || !w.every((x) => TITLE_FILLER.has(x))) return null;
  return { verdict: 'cut', code: CODES.filler, question: 3, evidence: `phrases: filler heading "${rule.text.replace(/^#\s+/, '').trim()}"` };
}

const GLOBAL: readonly RegExp[] = PHRASES.map((p) => new RegExp(p.pattern.source, 'giu')); // same order as PHRASES

export const q3: Check = (rule: Rule) => {
  if (rule.kind === 'heading') return fillerHeading(rule);
  if (rule.kind === 'code') return null;
  const text = rule.text.replace(LIST_MARKER, '');
  if (spans(text).length > 0 || citedPaths(text).length > 0) return null;

  let rest = text;
  const matched: { phrase: Phrase; text: string }[] = [];
  for (const [i, phrase] of PHRASES.entries()) {
    const re = GLOBAL[i];
    const first = re === undefined ? undefined : rest.match(re)?.[0];
    if (re === undefined || first === undefined) continue;
    matched.push({ phrase, text: first });
    rest = rest.replace(re, ' ');
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
