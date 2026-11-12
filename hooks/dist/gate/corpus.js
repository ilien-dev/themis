import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRules } from "./extract.js";
import { readFacts } from "./facts.js";
import { contextFor, judgeAll } from "./verdict.js";
const KINDS = new Set(['keep', 'cut', 'move', 'rewrite', 'fix', 'conflict']);
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v !== '';
// The cases of a corpus; throws with the line number of the first invalid one.
export function parseCorpus(text) {
    const out = [];
    const ids = new Set();
    for (const [i, raw] of text.split(/\r?\n/).entries()) {
        if (raw.trim() === '')
            continue;
        const fail = (why) => { throw new Error(`corpus line ${i + 1}: ${why}`); };
        let v;
        try {
            v = JSON.parse(raw);
        }
        catch {
            fail('not JSON');
        }
        if (!isObject(v))
            return fail('not an object');
        const { id, repo, file, rule, expect, code, line, gap } = v;
        if (!str(id) || !str(repo) || !str(file) || !str(rule))
            fail('id, repo, file and rule must be strings');
        if (typeof expect !== 'string' || !KINDS.has(expect))
            fail('expect is not a verdict');
        if (code !== undefined && !str(code))
            fail('code must be a string');
        if (expect !== 'keep' && code === undefined)
            fail('code is required unless expect is keep');
        if (line !== undefined && (typeof line !== 'number' || !Number.isInteger(line) || line < 1))
            fail('line must be a positive integer');
        if (gap !== undefined && (!str(gap) || expect !== 'keep'))
            fail('gap is a reason, only on keep');
        if (ids.has(id))
            fail(`duplicate id ${String(id)}`);
        ids.add(id);
        out.push(v);
    }
    return out;
}
// The one rule a case holds, at the line it gives.
export function caseRule(c) {
    const rules = parseRules(c.rule);
    const rule = rules[0];
    if (rules.length !== 1 || rule === undefined)
        throw new Error(`case ${c.id}: the text parses to ${rules.length} rules`);
    return c.line === undefined ? rule : { ...rule, line: c.line };
}
function copyDir(from, to) {
    mkdirSync(to, { recursive: true });
    for (const e of readdirSync(from, { withFileTypes: true })) {
        if (e.isDirectory())
            copyDir(join(from, e.name), join(to, e.name));
        else if (e.isFile())
            copyFileSync(join(from, e.name), join(to, e.name));
    }
}
// Judges cases against copies of their repos. Each repo is copied and initialised once, and each
// rule file's facts read once. Call `dispose` to remove the copies.
export class CorpusRunner {
    copies = new Map();
    facts = new Map();
    base;
    constructor(base) { this.base = base; }
    // The copy of `repo` as a fresh git repository with nothing committed.
    dirFor(repo) {
        let dir = this.copies.get(repo);
        if (dir === undefined) {
            dir = realpathSync(mkdtempSync(join(tmpdir(), 'themis-corpus-')));
            copyDir(join(this.base, repo), dir);
            spawnSync('git', ['init', '-q'], { cwd: dir, windowsHide: true });
            this.copies.set(repo, dir);
        }
        return dir;
    }
    factsFor(c) {
        const key = `${c.repo}\0${c.file}`;
        const known = this.facts.get(key);
        if (known !== undefined)
            return known;
        const facts = readFacts(join(this.dirFor(c.repo), c.file));
        const entry = { facts, ctx: contextFor(facts) };
        this.facts.set(key, entry);
        return entry;
    }
    run(c) {
        const { facts, ctx } = this.factsFor(c);
        const [v] = judgeAll([caseRule(c)], facts, ctx);
        if (v === undefined)
            throw new Error(`case ${c.id}: no verdict`);
        return v;
    }
    dispose() {
        for (const dir of this.copies.values())
            rmSync(dir, { recursive: true, force: true });
        this.copies.clear();
        this.facts.clear();
    }
}
// Does the gate give the case its label? A gap case may only be kept.
export const matches = (c, v) => v.verdict === c.expect && (c.expect === 'keep' || v.code === c.code);
