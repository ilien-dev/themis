import { interrupts } from "./verdict.js";
// What a user and a model read about the verdicts. Every function is pure and keeps the order it is given.
const MAX_SNIPPET = 100;
const NOTE_TEXT = {
    'no-evidence': 'nothing in the repository backs it',
    'no-anchor': 'nothing in it can be checked',
    'absolute-no-reason': 'an absolute without a reason',
};
const clip = (line) => (line.length <= MAX_SNIPPET ? line : `${line.slice(0, MAX_SNIPPET - 1)}…`);
// The first line of a rule, at most 100 characters: what the ask shows.
export const firstLine = (text) => clip((text.split('\n')[0] ?? '').trim());
// Like firstLine, but a bare fence (```) says nothing, so a code block shows its first line of content.
// For the check and audit listings.
export function snippet(text) {
    const lines = text.split('\n').map((l) => l.trim());
    return clip(lines.find((l) => l !== '' && !/^(?:`{3,}|~{3,})[\w-]*$/.test(l)) ?? lines[0] ?? '');
}
const withTarget = (v) => (v.target === undefined ? v.evidence : `${v.evidence} → ${v.target}`);
export function formatAsk(verdicts, fileName) {
    const flagged = verdicts.filter(interrupts);
    if (flagged.length === 0)
        return '';
    // A heading counts as a rule here only when it is itself interrupted (a title the repository already gives).
    const counted = verdicts.filter((v) => v.rule.kind !== 'heading' || interrupts(v)).length;
    const blocks = flagged.map((v) => [
        `  "${firstLine(v.rule.text)}"`,
        `  ${v.verdict} · ${v.code ?? ''} · question ${v.question ?? ''}`,
        `  ${withTarget(v)}`,
    ].join('\n'));
    return [
        `themis: ${flagged.length} of ${counted} new rules in ${fileName} may not be needed.`,
        ...blocks,
        'Approve to add them as written; themis will remember the choice. Deny to drop the edit.',
    ].join('\n\n');
}
function describe(note, v) {
    if (note !== 'accepted')
        return `${note} (${NOTE_TEXT[note]})`;
    const o = v.original;
    return o === undefined ? 'accepted' : `accepted (approved earlier despite ${o.verdict} · ${o.code})`;
}
// '' when no rule carries a note.
export function formatNotes(verdicts) {
    const lines = verdicts.filter((v) => v.notes.length > 0)
        .map((v) => `  "${snippet(v.rule.text)}": ${v.notes.map((n) => describe(n, v)).join(', ')}`);
    return lines.length === 0 ? '' : ['themis: notes on rules kept as written:', ...lines].join('\n');
}
// A rule is covered when a check answered it, or it was kept with something in the repository behind it.
export function coverage(verdicts) {
    const rules = verdicts.filter((v) => v.rule.kind !== 'heading');
    const covered = rules.filter((v) => v.verdict !== 'keep' || !v.notes.includes('no-evidence')).length;
    return { covered, total: rules.length };
}
const percent = (x) => `${(x * 100).toFixed(1)}%`;
const ratio = (a, b) => (b === 0 ? 0 : a / b);
export function coverageLine(verdicts) {
    const { covered, total } = coverage(verdicts);
    return `Coverage: ${covered} of ${total} rules (${percent(ratio(covered, total))}) matched a table or the repository.`;
}
const cell = (s) => s.replace(/\r?\n/g, ' ').replaceAll('|', '\\|');
export function formatAudit(verdicts) {
    const rows = verdicts.map((v) => `| ${[
        String(v.rule.line), snippet(v.rule.text), v.verdict, v.code ?? '', v.question === null ? '' : String(v.question),
        withTarget(v), v.notes.join(', '),
    ].map(cell).join(' | ')} |`);
    return [
        '| Line | Rule | Verdict | Code | Question | Evidence | Notes |',
        '| ---: | --- | --- | --- | ---: | --- | --- |',
        ...rows,
        '',
        coverageLine(verdicts),
    ].join('\n');
}
// A gap is a redundant rule the gate is known to keep: it is not a rule that must enter as written, and an
// interruption of it is deserved.
export function metrics(cases) {
    const hit = cases.filter((c) => interrupts(c.got));
    const shouldKeep = cases.filter((c) => c.expect === 'keep' && c.gap !== true);
    const byVerdict = {};
    for (const c of cases) {
        const entry = byVerdict[c.got.verdict] ?? { n: 0, correct: 0 };
        entry.n++;
        if (c.expect === c.got.verdict || (c.gap === true && interrupts(c.got)))
            entry.correct++;
        byVerdict[c.got.verdict] = entry;
    }
    const { covered, total } = coverage(cases.map((c) => c.got));
    return {
        interrupted: hit.length,
        precision: hit.length === 0 ? null : hit.filter((c) => c.expect !== 'keep' || c.gap === true).length / hit.length,
        falseCut: shouldKeep.length === 0 ? null : shouldKeep.filter((c) => interrupts(c.got)).length / shouldKeep.length,
        coverage: ratio(covered, total),
        byVerdict,
    };
}
export function formatMetrics(m, cases) {
    const p = m.precision === null ? 'n/a' : percent(m.precision);
    const f = m.falseCut === null ? 'n/a' : percent(m.falseCut);
    const kinds = Object.keys(m.byVerdict).sort();
    return [
        `Cases: ${cases}`,
        `Interrupted: ${m.interrupted}`,
        `Precision of interruption: ${p}`,
        `False-cut rate: ${f}`,
        `Coverage: ${percent(m.coverage)}`,
        'By verdict:',
        ...kinds.map((k) => { const e = m.byVerdict[k]; return `  ${k}: ${e?.correct ?? 0} of ${e?.n ?? 0} correct`; }),
    ].join('\n');
}
