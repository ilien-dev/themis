import type { Rule, RuleKind } from './types.ts';

// CommonMark: a fence may be indented up to three spaces, and only a bare run of the same character,
// at least as long as the opening one, closes it.
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{1,6})\s/;
const BULLET = /^[-*+]\s/;
const NUMBERED = /^\d+[.)]\s/;
const INDENTED = /^\s+\S/;
const BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/; // ---, ***, ___: a thematic break, not a rule

export function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
}

// Splits a markdown file into the units a rule gate judges. Only level-1 headings
// are rules; fenced blocks hide their content and join the paragraph that leads in.
export function parseRules(markdown: string): Rule[] {
  const src = markdown.replace(/\r\n?/g, '\n').split('\n');
  const rules: Rule[] = [];
  const push = (kind: RuleKind, start: number, end: number): void => {
    rules.push({ text: src.slice(start, end).join('\n'), kind, line: start + 1, lines: end - start });
  };
  const isBlank = (i: number): boolean => (src[i] ?? '').trim() === '';
  const fenceEnd = (open: number): number => {
    const marker = FENCE.exec(src[open] ?? '')?.[1] ?? '```';
    const close = new RegExp(`^ {0,3}${marker.startsWith('`') ? '`' : '~'}{${marker.length},}[ \\t]*$`);
    let i = open + 1;
    while (i < src.length && !close.test(src[i] ?? '')) i++;
    return Math.min(i + 1, src.length);
  };

  let i = 0;
  while (i < src.length) {
    const line = src[i] ?? '';
    if (isBlank(i) || BREAK.test(line)) { i++; continue; }
    if (FENCE.test(line)) {
      const end = fenceEnd(i);
      push('code', i, end);
      i = end;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      if (heading[1] === '#') push('heading', i, i + 1);
      i++;
      continue;
    }
    if (BULLET.test(line)) {
      let end = i + 1;
      while (end < src.length && INDENTED.test(src[end] ?? '')) end++;
      push('item', i, end);
      i = end;
      continue;
    }
    if (NUMBERED.test(line)) {
      let end = i + 1;
      let last = end;
      while (end < src.length) {
        const cur = src[end] ?? '';
        if (NUMBERED.test(cur) || INDENTED.test(cur)) { end++; last = end; } else if (isBlank(end)) end++;
        else break;
      }
      push('steps', i, last);
      i = last;
      continue;
    }
    // Paragraph, possibly followed by a fenced block with no blank line between.
    let end = i + 1;
    let kind: RuleKind = 'paragraph';
    while (end < src.length) {
      const cur = src[end] ?? '';
      if (isBlank(end) || BREAK.test(cur) || HEADING.test(cur) || BULLET.test(cur) || NUMBERED.test(cur)) break;
      if (FENCE.test(cur)) {
        end = fenceEnd(end);
        kind = 'code';
        break;
      }
      end++;
    }
    push(kind, i, end);
    i = end;
  }
  return rules;
}

// The rules of `after` whose normalized text is not present in `before`.
export function newRules(before: string | null, after: string): Rule[] {
  const known = new Set(before === null ? [] : parseRules(before).map((r) => normalize(r.text)));
  return parseRules(after).filter((r) => !known.has(normalize(r.text)));
}
