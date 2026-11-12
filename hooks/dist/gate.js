// The rule gate from the command line, for the skill and for measurement:
//   gate check  [--file <path>] [--json]   markdown on stdin; --file sets the repository (default ./CLAUDE.md)
//   gate audit  <file> [--json] [--prune]  every rule of a file and the coverage; --prune drops stale accepted rules
//   gate report <corpus.jsonl> [--json]    precision, false-cut rate and coverage of a labelled corpus
// Exit code 0 whenever the input is valid, 2 on wrong usage or unreadable input.
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { gitLines, read, RULE_FILE } from "./lib.js";
import { pruneAccepted } from "./gate/accepted.js";
import { CorpusRunner, matches, parseCorpus } from "./gate/corpus.js";
import { parseRules } from "./gate/extract.js";
import { readFacts } from "./gate/facts.js";
import { coverage, formatAudit, formatMetrics, formatNotes, metrics, snippet } from "./gate/format.js";
import { ruleHash } from "./gate/text.js";
import { contextFor, judgeAll } from "./gate/verdict.js";
const USAGE = 'usage: gate check [--file <path>] [--json] | gate audit <file> [--json] [--prune] | gate report <corpus.jsonl> [--json]';
class UsageError extends Error {
}
function parseArgs(argv, allowed, withFile) {
    const positional = [];
    const flags = new Set();
    let file;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] ?? '';
        if (withFile && a === '--file') {
            file = argv[++i];
            if (file === undefined || file === '')
                throw new UsageError('--file needs a path');
        }
        else if (a.startsWith('--')) {
            if (!allowed.includes(a))
                throw new UsageError(`unknown option ${a}`);
            flags.add(a);
        }
        else
            positional.push(a);
    }
    return { positional, flags, file };
}
// The verdict as JSON: the rule's place and text, then the verdict fields.
const toJson = (v) => ({
    line: v.rule.line, kind: v.rule.kind, text: v.rule.text, verdict: v.verdict, code: v.code, question: v.question, evidence: v.evidence,
    ...(v.target === undefined ? {} : { target: v.target }), notes: v.notes, ...(v.original === undefined ? {} : { original: v.original }),
});
const out = (s) => { process.stdout.write(s.endsWith('\n') ? s : `${s}\n`); };
function judgeText(markdown, facts) {
    return judgeAll(parseRules(markdown), facts, contextFor(facts));
}
async function stdin() {
    const chunks = [];
    for await (const c of process.stdin)
        chunks.push(c);
    return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
}
function checkLine(v) {
    const head = v.verdict === 'keep' ? 'keep' : `${v.verdict} · ${v.code ?? ''} · question ${v.question ?? ''}`;
    const evidence = v.verdict === 'keep' ? '' : `\n    ${v.target === undefined ? v.evidence : `${v.evidence} → ${v.target}`}`;
    return `${v.rule.line}: ${head}  "${snippet(v.rule.text)}"${evidence}`;
}
async function check(argv) {
    const args = parseArgs(argv, ['--json'], true);
    if (args.positional.length > 0)
        throw new UsageError(`unexpected argument ${args.positional[0] ?? ''}`);
    const verdicts = judgeText(await stdin(), readFacts(resolve(args.file ?? 'CLAUDE.md')));
    if (args.flags.has('--json')) {
        out(JSON.stringify(verdicts.map(toJson), null, 2));
        return;
    }
    const notes = formatNotes(verdicts);
    out([...verdicts.map(checkLine), ...(notes === '' ? [] : ['', notes])].join('\n'));
}
// Hashes of every rule in the repository's rule files: the accepted store is shared by all of them.
function liveHashes(file, facts) {
    const files = new Set([file]);
    for (const f of facts.files)
        if (RULE_FILE.test(basename(f)))
            files.add(join(facts.root, f));
    for (const d of [facts.root, facts.dir])
        files.add(join(d, 'CLAUDE.local.md'));
    const hashes = new Set();
    for (const f of files)
        for (const r of parseRules(read(f) ?? ''))
            hashes.add(ruleHash(r.text));
    return hashes;
}
function audit(argv) {
    const args = parseArgs(argv, ['--json', '--prune'], false);
    const [target, extra] = args.positional;
    if (target === undefined || extra !== undefined)
        throw new UsageError('audit takes one file');
    const file = resolve(target);
    const text = read(file);
    if (text === null)
        throw new UsageError(`cannot read ${target}`);
    const facts = readFacts(file);
    // Prune first, so a stale entry cannot shield a rule that changed.
    const pruned = args.flags.has('--prune') ? pruneAccepted(facts.root, liveHashes(file, facts)) : null;
    const verdicts = judgeText(text, facts);
    if (args.flags.has('--json')) {
        out(JSON.stringify({ verdicts: verdicts.map(toJson), coverage: coverage(verdicts), ...(pruned === null ? {} : { pruned }) }, null, 2));
        return;
    }
    const lines = [formatAudit(verdicts)];
    if (pruned !== null)
        lines.push(`Pruned ${pruned} stale accepted ${pruned === 1 ? 'entry' : 'entries'}.`);
    const notes = formatNotes(verdicts);
    if (notes !== '')
        lines.push('', notes);
    out(lines.join('\n'));
}
// Repos in a corpus are relative to the root of the git repository that holds it.
function corpusBase(corpus) {
    const dir = dirname(corpus);
    return gitLines(dir, ['rev-parse', '--show-toplevel'])?.[0] ?? dir;
}
function report(argv) {
    const args = parseArgs(argv, ['--json'], false);
    const [target, extra] = args.positional;
    if (target === undefined || extra !== undefined)
        throw new UsageError('report takes one corpus file');
    const corpus = resolve(target);
    const text = read(corpus);
    if (text === null)
        throw new UsageError(`cannot read ${target}`);
    let cases;
    try {
        cases = parseCorpus(text);
    }
    catch (e) {
        throw new UsageError(e.message);
    }
    const base = corpusBase(corpus);
    const missing = [...new Set(cases.map((c) => c.repo))].find((r) => !existsSync(join(base, r)));
    if (missing !== undefined)
        throw new UsageError(`repo ${missing} not found under ${base}`);
    const runner = new CorpusRunner(base);
    try {
        const results = cases.map((c) => ({ c, got: runner.run(c) }));
        const m = metrics(results.map((r) => ({ expect: r.c.expect, got: r.got })));
        const wrong = results.filter((r) => !matches(r.c, r.got));
        const gaps = cases.filter((c) => c.gap !== undefined).length;
        if (args.flags.has('--json')) {
            out(JSON.stringify({
                cases: cases.length, gaps, metrics: m,
                mismatches: wrong.map((r) => ({ id: r.c.id, expect: r.c.expect, code: r.c.code ?? null, got: r.got.verdict, gotCode: r.got.code })),
            }, null, 2));
            return;
        }
        const lines = [formatMetrics(m, cases.length), `Known gaps (redundant rules kept): ${gaps}`];
        if (wrong.length > 0) {
            lines.push(`Mismatches: ${wrong.length}`);
            const label = (verdict, code) => (code === undefined || code === null ? verdict : `${verdict} ${code}`);
            for (const r of wrong)
                lines.push(`  ${r.c.id}: expected ${label(r.c.expect, r.c.code)}, got ${label(r.got.verdict, r.got.code)}`);
        }
        else
            lines.push('Mismatches: 0');
        out(lines.join('\n'));
    }
    finally {
        runner.dispose();
    }
}
async function main(argv) {
    const [command, ...rest] = argv;
    try {
        if (command === 'check')
            await check(rest);
        else if (command === 'audit')
            audit(rest);
        else if (command === 'report')
            report(rest);
        else
            throw new UsageError(command === undefined ? 'no subcommand' : `unknown subcommand ${command}`);
        return 0;
    }
    catch (e) {
        if (!(e instanceof UsageError))
            throw e;
        process.stderr.write(`gate: ${e.message}\n${USAGE}\n`);
        return 2;
    }
}
process.exitCode = await main(process.argv.slice(2));
