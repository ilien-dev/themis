import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { read } from "../lib.js";
import { ruleHash } from "./text.js";
export const ACCEPTED_FILE = '.claude/themis-accepted.json';
const VERDICTS = new Set(['cut', 'move', 'rewrite', 'fix', 'conflict']);
const QUESTIONS = new Set([1, 2, 3, 5, 6, 7]);
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
function toEntry(v) {
    if (!isObject(v))
        return null;
    const { verdict, code, question, evidence, target, date } = v;
    if (typeof verdict !== 'string' || !VERDICTS.has(verdict))
        return null;
    if (typeof code !== 'string' || typeof evidence !== 'string' || typeof date !== 'string')
        return null;
    if (typeof question !== 'number' || !QUESTIONS.has(question))
        return null;
    if (target !== undefined && typeof target !== 'string')
        return null;
    const base = { verdict, code, question, evidence, date };
    return target === undefined ? base : { ...base, target };
}
function readEntries(root) {
    const out = new Map();
    const text = read(join(root, ACCEPTED_FILE));
    if (text === null)
        return out;
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        return out;
    }
    if (!isObject(data) || !isObject(data['rules']))
        return out;
    for (const [hash, raw] of Object.entries(data['rules'])) {
        const entry = toEntry(raw);
        if (entry !== null)
            out.set(hash, entry);
    }
    return out;
}
function writeEntries(root, entries) {
    try {
        const rules = {};
        for (const hash of [...entries.keys()].sort()) {
            const e = entries.get(hash);
            if (e === undefined)
                continue;
            rules[hash] = { verdict: e.verdict, code: e.code, question: e.question, evidence: e.evidence, ...(e.target === undefined ? {} : { target: e.target }), date: e.date };
        }
        const file = join(root, ACCEPTED_FILE);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `${JSON.stringify({ version: 1, rules }, null, 2)}\n`);
    }
    catch { /* hooks fail silent */ }
}
export function loadAccepted(root) {
    const out = new Map();
    for (const [hash, e] of readEntries(root)) {
        const answer = { verdict: e.verdict, code: e.code, question: e.question, evidence: e.evidence };
        out.set(hash, e.target === undefined ? answer : { ...answer, target: e.target });
    }
    return out;
}
export function recordAccepted(root, verdicts, date) {
    const entries = readEntries(root);
    let added = false;
    for (const v of verdicts) {
        if (v.verdict === 'keep' || v.code === null || v.question === null)
            continue;
        const question = v.question;
        const base = { verdict: v.verdict, code: v.code, question, evidence: v.evidence, date };
        entries.set(ruleHash(v.rule.text), v.target === undefined ? base : { ...base, target: v.target });
        added = true;
    }
    if (added || entries.size === 0)
        writeEntries(root, entries);
}
export function pruneAccepted(root, liveHashes) {
    const entries = readEntries(root);
    let removed = 0;
    for (const hash of [...entries.keys()]) {
        if (!liveHashes.has(hash)) {
            entries.delete(hash);
            removed++;
        }
    }
    if (removed > 0)
        writeEntries(root, entries);
    return removed;
}
export function pendingKey(sessionId, file, toolInput) {
    return createHash('sha256').update(JSON.stringify([sessionId, file, toolInput ?? null])).digest('hex');
}
const pendingDir = () => join(tmpdir(), 'themis-gate');
export function writePending(key, hashes) {
    try {
        const dir = pendingDir();
        mkdirSync(dir, { recursive: true });
        const now = Date.now();
        for (const name of readdirSync(dir)) {
            try {
                const path = join(dir, name);
                if (now - statSync(path).mtimeMs > PENDING_TTL_MS)
                    rmSync(path, { force: true });
            }
            catch { /* a stale file that cannot go is not worth failing for */ }
        }
        writeFileSync(join(dir, `${key}.json`), JSON.stringify(hashes));
    }
    catch { /* hooks fail silent */ }
}
export function takePending(key) {
    const path = join(pendingDir(), `${key}.json`);
    const text = read(path);
    if (text === null)
        return null;
    try {
        rmSync(path, { force: true });
    }
    catch { /* ignore */ }
    try {
        const data = JSON.parse(text);
        return Array.isArray(data) && data.every((h) => typeof h === 'string') ? data : null;
    }
    catch {
        return null;
    }
}
