import { interrupts } from './verdict.ts';
import type { Note, Verdict, VerdictKind } from './types.ts';

// What a user and a model read about the verdicts. Every function is pure and keeps the order it is given.

const MAX_SNIPPET = 100;

const NOTE_TEXT: Readonly<Record<Exclude<Note, 'accepted'>, string>> = {
  'no-evidence': 'nothing in the repository backs it',
  'no-anchor': 'nothing in it can be checked',
  'absolute-no-reason': 'an absolute without a reason',
};

const clip = (line: string): string => (line.length <= MAX_SNIPPET ? line : `${line.slice(0, MAX_SNIPPET - 1)}…`);

// The first line of a rule, at most 100 characters: what the ask shows.
export const firstLine = (text: string): string => clip((text.split('\n')[0] ?? '').trim());

// Like firstLine, but a bare fence (```) says nothing, so a code block shows its first line of content.
// For the check and audit listings.
export function snippet(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  return clip(lines.find((l) => l !== '' && !/^(?:`{3,}|~{3,})[\w-]*$/.test(l)) ?? lines[0] ?? '');
}

const withTarget = (v: Verdict): string => (v.target === undefined ? v.evidence : `${v.evidence} → ${v.target}`);

export function formatAsk(verdicts: readonly Verdict[], fileName: string): string {
  const flagged = verdicts.filter(interrupts);
  if (flagged.length === 0) return '';
  const blocks = flagged.map((v) => [
    `  "${firstLine(v.rule.text)}"`,
    `  ${v.verdict} · ${v.code ?? ''} · question ${v.question ?? ''}`,
    `  ${withTarget(v)}`,
  ].join('\n'));
  return [
    `themis: ${flagged.length} of ${verdicts.length} new rules in ${fileName} may not be needed.`,
    ...blocks,
    'Approve to add them as written; themis will remember the choice. Deny to drop the edit.',
  ].join('\n\n');
}

function describe(note: Note, v: Verdict): string {
  if (note !== 'accepted') return `${note} (${NOTE_TEXT[note]})`;
  const o = v.original;
  return o === undefined ? 'accepted' : `accepted (approved earlier despite ${o.verdict} · ${o.code})`;
}

// '' when no rule carries a note.
export function formatNotes(verdicts: readonly Verdict[]): string {
  const lines = verdicts.filter((v) => v.notes.length > 0)
    .map((v) => `  "${snippet(v.rule.text)}": ${v.notes.map((n) => describe(n, v)).join(', ')}`);
  return lines.length === 0 ? '' : ['themis: notes on rules kept as written:', ...lines].join('\n');
}

// A rule is covered when a check answered it, or it was kept with something in the repository behind it.
export function coverage(verdicts: readonly Verdict[]): { covered: number; total: number } {
  const rules = verdicts.filter((v) => v.rule.kind !== 'heading');
  const covered = rules.filter((v) => v.verdict !== 'keep' || !v.notes.includes('no-evidence')).length;
  return { covered, total: rules.length };
}

const percent = (x: number): string => `${(x * 100).toFixed(1)}%`;
const ratio = (a: number, b: number): number => (b === 0 ? 0 : a / b);

export function coverageLine(verdicts: readonly Verdict[]): string {
  const { covered, total } = coverage(verdicts);
  return `Coverage: ${covered} of ${total} rules (${percent(ratio(covered, total))}) matched a table or the repository.`;
}

const cell = (s: string): string => s.replace(/\r?\n/g, ' ').replaceAll('|', '\\|');

export function formatAudit(verdicts: readonly Verdict[]): string {
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

export interface Metrics {
  interrupted: number;
  precision: number | null; // of the interrupted rules, the share that deserved an interruption
  falseCut: number | null; // of the rules that should enter as written, the share interrupted
  coverage: number;
  byVerdict: Record<string, { n: number; correct: number }>; // by the verdict the gate gave
}

export function metrics(cases: readonly { expect: VerdictKind; got: Verdict }[]): Metrics {
  const hit = cases.filter((c) => interrupts(c.got));
  const shouldKeep = cases.filter((c) => c.expect === 'keep');
  const byVerdict: Record<string, { n: number; correct: number }> = {};
  for (const c of cases) {
    const entry = byVerdict[c.got.verdict] ?? { n: 0, correct: 0 };
    entry.n++;
    if (c.expect === c.got.verdict) entry.correct++;
    byVerdict[c.got.verdict] = entry;
  }
  const { covered, total } = coverage(cases.map((c) => c.got));
  return {
    interrupted: hit.length,
    precision: hit.length === 0 ? null : hit.filter((c) => c.expect !== 'keep').length / hit.length,
    falseCut: shouldKeep.length === 0 ? null : shouldKeep.filter((c) => interrupts(c.got)).length / shouldKeep.length,
    coverage: ratio(covered, total),
    byVerdict,
  };
}

export function formatMetrics(m: Metrics, cases: number): string {
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
