import { createHash } from 'node:crypto';
import { normalize } from "./extract.js";
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const WB_BEFORE = String.raw `(?<![\p{L}\p{N}_])`;
const WB_AFTER = String.raw `(?![\p{L}\p{N}_])`;
// Lowercase words without punctuation or a leading list marker.
export function words(text) {
    return text.replace(LIST_MARKER, '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}
// Is what remains of a rule once its matched phrase is removed only connective words, with no digits?
export function onlyConnectives(rest, allowed) {
    return !/\d/.test(rest) && words(rest).every((w) => allowed.has(w));
}
function trigrams(text) {
    const w = [...new Set(words(text))]; // repetition adds nothing
    const out = new Set();
    for (let i = 0; i + 2 < w.length; i++)
        out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
    return out;
}
// Jaccard over word trigrams; 0 when either text has fewer than 3 distinct words.
export function similarity(a, b) {
    const x = trigrams(a);
    const y = trigrams(b);
    if (x.size === 0 || y.size === 0)
        return 0;
    let shared = 0;
    for (const t of x)
        if (y.has(t))
            shared++;
    return shared / (x.size + y.size - shared);
}
// The content of each `code span`.
export function spans(text) {
    return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '');
}
export function citedPaths(text) {
    const out = [];
    for (const s of spans(text)) {
        const p = s.replaceAll('\\', '/');
        if (/\s/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p) || /[*?{<]/.test(p))
            continue;
        if (p.includes('/') || /\.[A-Za-z]{1,5}$/.test(p))
            out.push(p);
    }
    return out;
}
const NPM_SCRIPTS = new Set(['test', 'start', 'stop', 'restart']);
const NOT_SCRIPTS = new Set(['install', 'i', 'add', 'ci', 'init', 'publish', 'exec', 'x', 'dlx', 'create', 'remove', 'rm', 'update', 'up', 'link', 'audit', 'help', 'config', 'cache', 'pack', 'version']);
// `npm run x`, `npm test`, `pnpm x`, `yarn x`, `bun run x`.
export function citedScripts(text) {
    const out = [];
    for (const s of spans(text)) {
        const m = /^(npm|pnpm|yarn|bun)\s+(run\s+)?([\w:.-]+)/.exec(s.trim());
        const pm = m?.[1];
        const script = m?.[3];
        if (pm === undefined || script === undefined)
            continue;
        const explicit = m?.[2] !== undefined;
        if (!explicit && (pm === 'npm' ? !NPM_SCRIPTS.has(script) : NOT_SCRIPTS.has(script)))
            continue;
        out.push({ pm, script });
    }
    return out;
}
export const ABSOLUTE = new RegExp(`${WB_BEFORE}(?:never|always|under no circumstances|nunca|siempre|jam\u00e1s)${WB_AFTER}`, 'iu');
const REASON = new RegExp(`${WB_BEFORE}(?:because|since|so that|or (?:they|it)|porque|para que|ya que)${WB_AFTER}`, 'iu');
// A reason is a connective, or a clause after ";" or an em dash that is not itself an absolute.
export function hasReason(text) {
    if (REASON.test(text))
        return true;
    return text.split(/[;\u2014]/).slice(1).some((clause) => /[\p{L}\p{N}]/u.test(clause) && !ABSOLUTE.test(clause));
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function mentions(text, term) {
    return term !== '' && new RegExp(`${WB_BEFORE}${escape(term)}${WB_AFTER}`, 'iu').test(text);
}
// Something checkable in the rule: a span, a path, an identifier or a known technology.
export function hasAnchor(text, techNames) {
    if (spans(text).length > 0 || citedPaths(text).length > 0)
        return true;
    if (/(?<![\w])[a-z]+[A-Z]\w*|(?<![\w])\w+_\w+|(?<![\w.])\w+\.\w+/.test(text))
        return true;
    return techNames.some((t) => mentions(text, t));
}
// sha256 of the normalized text without its leading list marker, first 16 hex digits.
export function ruleHash(text) {
    return createHash('sha256').update(normalize(text).replace(LIST_MARKER, '')).digest('hex').slice(0, 16);
}
