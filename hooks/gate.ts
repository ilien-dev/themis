// The rule gate from the command line, for the skill and for measurement:
//   gate check  [--rules <path>] [--file <path>] [--json] [--paths]   markdown from --rules (UTF-8) or stdin; --file sets the repository (default ./CLAUDE.md)
//   gate audit  <file> [--json] [--prune] [--paths]  every rule of a file and the coverage; --prune drops stale accepted rules
//   gate report <corpus.jsonl> [--json] [--paths]    precision, false-cut rate and coverage of a labelled corpus
// --paths turns on the described-path detector (the gate_paths option of the hook), off by default.
// Exit code 0 whenever the input is valid, 2 on wrong usage or unreadable input.
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { gitLines, read, RULE_FILE } from './lib.ts';
import { pruneAccepted } from './gate/accepted.ts';
import { CorpusRunner, matches, parseCorpus, type Case } from './gate/corpus.ts';
import { parseRules } from './gate/extract.ts';
import { readFacts, type Facts } from './gate/facts.ts';
import { coverage, formatAudit, formatMetrics, formatNotes, formatStaleVendor, metrics, snippet, staleVendor } from './gate/format.ts';
import { PHRASES } from './gate/tables/phrases.ts';
import { ruleHash } from './gate/text.ts';
import { contextFor, judgeAll } from './gate/verdict.ts';
import type { Verdict } from './gate/types.ts';

const USAGE = 'usage: gate check [--rules <path>] [--file <path>] [--json] [--paths] | gate audit <file> [--json] [--prune] [--paths] | gate report <corpus.jsonl> [--json] [--paths]';

class UsageError extends Error {}
// Valid usage on input that is not there: the message says how to get it, and the usage line is left out.
class InputError extends Error {}

interface Args { readonly positional: string[]; readonly flags: Set<string>; readonly values: ReadonlyMap<string, string> }

// `valued` are the options that take a path.
function parseArgs(argv: readonly string[], allowed: readonly string[], valued: readonly string[] = []): Args {
  const positional: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (valued.includes(a)) {
      const v = argv[++i];
      if (v === undefined || v === '' || v.startsWith('--')) throw new UsageError(`${a} needs a path`);
      values.set(a, v);
    } else if (a.startsWith('--')) {
      if (!allowed.includes(a)) throw new UsageError(`unknown option ${a}`);
      flags.add(a);
    } else positional.push(a);
  }
  return { positional, flags, values };
}

// The verdict as JSON: the rule's place and text, then the verdict fields.
const toJson = (v: Verdict): Record<string, unknown> => ({
  line: v.rule.line, kind: v.rule.kind, text: v.rule.text, verdict: v.verdict, code: v.code, question: v.question, evidence: v.evidence,
  ...(v.target === undefined ? {} : { target: v.target }), notes: v.notes, ...(v.original === undefined ? {} : { original: v.original }),
});

const out = (s: string): void => { process.stdout.write(s.endsWith('\n') ? s : `${s}\n`); };

function judgeText(markdown: string, facts: Facts, paths: boolean): Verdict[] {
  return judgeAll(parseRules(markdown), facts, contextFor(facts, { paths }));
}

async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin as AsyncIterable<Buffer>) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
}

function checkLine(v: Verdict): string {
  const head = v.verdict === 'keep' ? 'keep' : `${v.verdict} · ${v.code ?? ''} · question ${v.question ?? ''}`;
  const evidence = v.verdict === 'keep' ? '' : `\n    ${v.target === undefined ? v.evidence : `${v.evidence} → ${v.target}`}`;
  return `${v.rule.line}: ${head}  "${snippet(v.rule.text)}"${evidence}`;
}

async function check(argv: readonly string[]): Promise<void> {
  const args = parseArgs(argv, ['--json', '--paths'], ['--file', '--rules']);
  if (args.positional.length > 0) throw new UsageError(`unexpected argument ${args.positional[0] ?? ''}`);
  // A file read as UTF-8 reaches the gate unchanged; a pipe from Windows PowerShell 5.1 re-encodes non-ASCII text.
  const rulesPath = args.values.get('--rules');
  const fromFile = rulesPath === undefined ? null : read(resolve(rulesPath));
  if (rulesPath !== undefined && fromFile === null) throw new UsageError(`cannot read ${rulesPath}`);
  const markdown = fromFile === null ? await stdin() : fromFile.replace(/^\uFEFF/, '');
  const verdicts = judgeText(markdown, readFacts(resolve(args.values.get('--file') ?? 'CLAUDE.md')), args.flags.has('--paths'));
  if (args.flags.has('--json')) { out(JSON.stringify(verdicts.map(toJson), null, 2)); return; }
  const notes = formatNotes(verdicts);
  out([...verdicts.map(checkLine), ...(notes === '' ? [] : ['', notes])].join('\n'));
}

// Hashes of every rule in the repository's rule files: the accepted store is shared by all of them.
function liveHashes(file: string, facts: Facts): Set<string> {
  const files = new Set([file]);
  for (const f of facts.files) if (RULE_FILE.test(basename(f))) files.add(join(facts.root, f));
  for (const d of [facts.root, facts.dir]) files.add(join(d, 'CLAUDE.local.md'));
  const hashes = new Set<string>();
  for (const f of files) for (const r of parseRules(read(f) ?? '')) hashes.add(ruleHash(r.text));
  return hashes;
}

function audit(argv: readonly string[]): void {
  const args = parseArgs(argv, ['--json', '--prune', '--paths']);
  const [target, extra] = args.positional;
  if (target === undefined || extra !== undefined) throw new UsageError('audit takes one file');
  const file = resolve(target);
  const text = read(file);
  if (text === null) throw new UsageError(`cannot read ${target}`);
  const facts = readFacts(file);
  // Prune first, so a stale entry cannot shield a rule that changed. Without the file listing the other
  // rule files sharing the store are unknown, and their entries would look stale: then nothing is pruned.
  const prune = args.flags.has('--prune');
  const canPrune = facts.inRepo && facts.filesKnown;
  const pruned = prune && canPrune ? pruneAccepted(facts.root, liveHashes(file, facts)) : null;
  const verdicts = judgeText(text, facts, args.flags.has('--paths'));
  if (args.flags.has('--json')) {
    out(JSON.stringify({ verdicts: verdicts.map(toJson), coverage: coverage(verdicts), ...(prune ? { pruned } : {}) }, null, 2));
    return;
  }
  const lines = [formatAudit(verdicts)];
  if (pruned !== null) lines.push(`Pruned ${pruned} stale accepted ${pruned === 1 ? 'entry' : 'entries'}.`);
  else if (prune) lines.push('Not pruned: the rule files of this repository are unknown outside a git repository.');
  const notes = formatNotes(verdicts);
  if (notes !== '') lines.push('', notes);
  out(lines.join('\n'));
}

// Repos in a corpus are relative to the root of the git repository that holds it.
function corpusBase(corpus: string): string {
  const dir = dirname(corpus);
  return gitLines(dir, ['rev-parse', '--show-toplevel'])?.[0] ?? dir;
}

function report(argv: readonly string[]): void {
  const args = parseArgs(argv, ['--json', '--paths']);
  const [target, extra] = args.positional;
  if (target === undefined || extra !== undefined) throw new UsageError('report takes one corpus file');
  const corpus = resolve(target);
  const text = read(corpus);
  if (text === null) throw new UsageError(`cannot read ${target}`);
  let cases: Case[];
  try { cases = parseCorpus(text); } catch (e) { throw new UsageError((e as Error).message); }
  const base = corpusBase(corpus);
  const missing = [...new Set(cases.map((c) => c.repo))].find((r) => !existsSync(join(base, r)));
  if (missing !== undefined) {
    // The snapshots of the held-out corpora are not stored in the repository.
    throw new InputError(`repo ${missing} not found under ${base}. Rebuild the snapshots with tests/gate/holdout/collect.mjs ` +
      'and then tests/gate/holdout/fetch-cited.mjs, as the SOURCES.md next to the corpus says.');
  }

  const runner = new CorpusRunner(base, { paths: args.flags.has('--paths') });
  try {
    const results = cases.map((c) => ({ c, got: runner.run(c) }));
    const m = metrics(results.map((r) => ({ expect: r.c.expect, got: r.got, gap: r.c.gap !== undefined })));
    const wrong = results.filter((r) => !matches(r.c, r.got));
    const gaps = cases.filter((c) => c.gap !== undefined).length;
    const stale = staleVendor(PHRASES, new Date()); // the one place the gate reads the clock
    if (args.flags.has('--json')) {
      out(JSON.stringify({
        cases: cases.length, gaps, metrics: m,
        mismatches: wrong.map((r) => ({ id: r.c.id, expect: r.c.expect, code: r.c.code ?? null, got: r.got.verdict, gotCode: r.got.code })),
        staleVendor: stale,
      }, null, 2));
      return;
    }
    const lines = [formatMetrics(m, cases.length), `Known gaps (redundant rules kept): ${gaps}`];
    if (wrong.length > 0) {
      lines.push(`Mismatches: ${wrong.length}`);
      const label = (verdict: string, code: string | null | undefined): string => (code === undefined || code === null ? verdict : `${verdict} ${code}`);
      for (const r of wrong) lines.push(`  ${r.c.id}: expected ${label(r.c.expect, r.c.code)}, got ${label(r.got.verdict, r.got.code)}`);
    } else lines.push('Mismatches: 0');
    lines.push(formatStaleVendor(stale));
    out(lines.join('\n'));
  } finally {
    runner.dispose();
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'check') await check(rest);
    else if (command === 'audit') audit(rest);
    else if (command === 'report') report(rest);
    else throw new UsageError(command === undefined ? 'no subcommand' : `unknown subcommand ${command}`);
    return 0;
  } catch (e) {
    if (e instanceof InputError) {
      process.stderr.write(`gate: ${e.message}\n`);
      return 2;
    }
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`gate: ${e.message}\n${USAGE}\n`);
    return 2;
  }
}

process.exitCode = await main(process.argv.slice(2));
