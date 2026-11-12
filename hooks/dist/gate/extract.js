const FENCE = /^(`{3,}|~{3,})/;
const HEADING = /^(#{1,6})\s/;
const BULLET = /^[-*+]\s/;
const NUMBERED = /^\d+[.)]\s/;
const INDENTED = /^\s+\S/;
export function normalize(text) {
    return text.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
}
// Splits a markdown file into the units a rule gate judges. Only level-1 headings
// are rules; fenced blocks hide their content and join the paragraph that leads in.
export function parseRules(markdown) {
    const src = markdown.replace(/\r\n?/g, '\n').split('\n');
    const rules = [];
    const push = (kind, start, end) => {
        rules.push({ text: src.slice(start, end).join('\n'), kind, line: start + 1, lines: end - start });
    };
    const isBlank = (i) => (src[i] ?? '').trim() === '';
    const fenceEnd = (open) => {
        const marker = FENCE.exec(src[open] ?? '')?.[1] ?? '```';
        let i = open + 1;
        while (i < src.length && !(src[i] ?? '').startsWith(marker))
            i++;
        return Math.min(i + 1, src.length);
    };
    let i = 0;
    while (i < src.length) {
        const line = src[i] ?? '';
        if (isBlank(i)) {
            i++;
            continue;
        }
        if (FENCE.test(line)) {
            const end = fenceEnd(i);
            push('code', i, end);
            i = end;
            continue;
        }
        const heading = HEADING.exec(line);
        if (heading) {
            if (heading[1] === '#')
                push('heading', i, i + 1);
            i++;
            continue;
        }
        if (BULLET.test(line)) {
            let end = i + 1;
            while (end < src.length && INDENTED.test(src[end] ?? ''))
                end++;
            push('item', i, end);
            i = end;
            continue;
        }
        if (NUMBERED.test(line)) {
            let end = i + 1;
            let last = end;
            while (end < src.length) {
                const cur = src[end] ?? '';
                if (NUMBERED.test(cur) || INDENTED.test(cur)) {
                    end++;
                    last = end;
                }
                else if (isBlank(end))
                    end++;
                else
                    break;
            }
            push('steps', i, last);
            i = last;
            continue;
        }
        // Paragraph, possibly followed by a fenced block with no blank line between.
        let end = i + 1;
        let kind = 'paragraph';
        while (end < src.length) {
            const cur = src[end] ?? '';
            if (isBlank(end) || HEADING.test(cur) || BULLET.test(cur) || NUMBERED.test(cur))
                break;
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
export function newRules(before, after) {
    const known = new Set(before === null ? [] : parseRules(before).map((r) => normalize(r.text)));
    return parseRules(after).filter((r) => !known.has(normalize(r.text)));
}
