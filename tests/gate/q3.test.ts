import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from '../../hooks/gate/extract.ts';
import { readFacts } from '../../hooks/gate/facts.ts';
import { q3 } from '../../hooks/gate/checks/q3.ts';
import { CHECKS } from '../../hooks/gate/verdict.ts';
import { PHRASES } from '../../hooks/gate/tables/phrases.ts';
import type { Answer } from '../../hooks/gate/types.ts';
import { repo } from './helpers.ts';

const FIXTURE = 'evals/cases/c14-themis-audit/fixture';
const facts = readFacts(join(repo({ 'package.json': '{"name":"app"}' }), 'CLAUDE.md'));

// The answer of q3 to the first rule of `text`.
function ask(text: string): Answer | null {
  const rule = parseRules(text)[0];
  if (rule === undefined) throw new Error('no rule parsed');
  return q3(rule, facts);
}

test('the table is registered after question 2 and every vendor entry names a dated source', () => {
  assert.ok(CHECKS.some((c) => c.question === 3 && c.run === q3));
  assert.ok(CHECKS.findIndex((c) => c.question === 3) > CHECKS.findIndex((c) => c.question === 2));
  const vendors = PHRASES.filter((p) => p.group === 'vendor');
  assert.ok(vendors.length >= 4);
  for (const p of vendors) {
    assert.ok(p.source !== undefined);
    assert.ok(p.source.url.startsWith('https://'));
    assert.match(p.source.retrieved, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(p.source.models.length > 0);
  }
  for (const p of PHRASES) assert.ok(p.group === 'vendor' || p.source === undefined);
});

// The two behaviour lines (double-check, be thorough) stay: no vendor in the window asks to remove them.
const BEHAVIOUR = new Set(['- Double-check your work before finishing.', '- Be thorough and careful.']);
test('"General guidelines" in c14: "Think step by step" is vendor-declared, the advice generic, the behaviour lines kept', () => {
  const rules = parseRules(readFileSync(join(FIXTURE, 'CLAUDE.md'), 'utf8'));
  const lines = rules.filter((r) => r.line >= 23 && r.line <= 32); // the items under "## General guidelines"
  assert.equal(lines.length, 10);
  for (const rule of lines) {
    const a = q3(rule, facts);
    if (BEHAVIOUR.has(rule.text)) { assert.equal(a, null, rule.text); continue; }
    assert.equal(a?.verdict, 'cut', rule.text);
    assert.equal(a.question, 3);
    assert.equal(a.code, rule.text.startsWith('- Think step by step') ? 'vendor-declared' : 'generic-advice', rule.text);
  }
});

test('the vendor evidence names the phrase and the source', () => {
  const a = ask('- Think step by step before making changes.');
  assert.equal(a?.code, 'vendor-declared');
  assert.match(a.evidence, /^phrases: vendor "Think step by step before making changes" \(https:\/\/platform\.claude\.com\//);
});

test('the file filler of c14 is cut as file-filler', () => {
  const a = ask('This file gives Claude context about the Ledger project so it can help effectively. Keep it updated as the project evolves.');
  assert.equal(a?.code, 'file-filler');
  assert.match(a.evidence, /^phrases: filler "This file gives Claude context/);
  assert.equal(ask('Este archivo proporciona contexto sobre el proyecto Ledger. Mantenlo actualizado.')?.code, 'file-filler');
});

test('the repeated generic sentence of the Notes section is cut', () => {
  const rules = parseRules(readFileSync(join(FIXTURE, 'CLAUDE.md'), 'utf8'));
  const notes = rules.find((r) => r.text.startsWith('Remember to keep the code quality high'));
  assert.ok(notes);
  assert.ok(notes.text.split('Remember to').length > 20);
  const a = q3(notes, facts);
  assert.equal(a?.code, 'generic-advice');
  assert.match(a.evidence, /^phrases: generic "/);
  assert.equal(ask('Remember to keep the code quality high and to communicate clearly about changes.')?.code, 'generic-advice');
});

test('several generic phrases in one rule are all removed', () => {
  assert.equal(ask('Write clean code. Handle errors properly. Write tests for your code.')?.code, 'generic-advice');
});

test('Spanish forms are cut', () => {
  assert.equal(ask('Escribe c\u00f3digo limpio y maneja los errores.')?.code, 'generic-advice');
  assert.equal(ask('Piensa paso a paso antes de responder.')?.code, 'vendor-declared');
  assert.equal(ask('Piensa con cuidado.')?.code, 'vendor-declared');
  assert.equal(ask('Siempre escribe código limpio.')?.code, 'generic-advice');
});

test('the lists of "What does not belong" are cut', () => {
  for (const t of ['Write clean code.', 'Handle errors.', 'Use TypeScript types.', 'Think carefully before answering.']) {
    assert.equal(ask(t)?.verdict, 'cut', t);
  }
});

test('a rule that carries a check, a path or a span is kept', () => {
  assert.equal(ask('Write clean code: no function over 40 lines in `src/core/`.'), null);
  assert.equal(ask('Handle errors with `AppError` from src/errors.js.'), null);
  assert.equal(ask('Write clean code: no function over 40 lines.'), null);
  assert.equal(ask('Think step by step and run `npm run lint` after each change.'), null);
});

test('a rule with a negation, an absolute, a condition, a number or an unknown word is kept', () => {
  for (const t of [
    'Never write clean code without tests.',
    'Write clean code, except in generated files.',
    'Handle errors properly when the payment provider times out.',
    'Handle errors properly and retry 3 times.',
    'Write clean code in the billing module.',
    'Always handle errors properly, but log nothing about card numbers.',
    'Keep functions small and focused, under 20 lines.',
    'Think carefully before touching the ledger tables.',
    'Do not edit tests to make them pass unless the spec changed.',
    'Keep it updated by running the sync job every Friday.',
    'Be thorough with Stripe webhooks.',
    'Use modern ES features only in src/.',
    'Siempre maneja los errores de pago con reintentos.',
    'Use branded types.',
    'Use opaque types.',
    'Use strict types.',
    'Follow best practices for security.',
    'Use latest Node features.',
    'This file gives context about security.',
    'Este archivo proporciona contexto sobre seguridad.',
  ]) {
    assert.equal(ask(t), null, t);
  }
});

test('a rule with no generic phrase is kept; headings and code are skipped', () => {
  assert.equal(ask('All money values are integer cents.'), null);
  assert.equal(ask('# General guidelines'), null);
  assert.equal(ask('```\nWrite clean code.\n```'), null);
});

test('patterns stay linear on adversarial input', () => {
  const started = Date.now();
  for (const t of [
    `This file gives ${'x '.repeat(20000)}`,
    `write ${'clean, '.repeat(20000)}`,
    'think '.repeat(20000),
    `Remember to ${'keep the code quality high and '.repeat(5000)}`,
    `handle ${'errors '.repeat(20000)}`,
  ]) ask(t);
  assert.ok(Date.now() - started < 2000);
});

// Controller ruling after task 9: a claim about what the model already does is cut only when a vendor
// says so (group vendor) or it is measured. Behaviour instructions to the agent stay until then.
test('a behaviour instruction to the agent is not generic advice', () => {
  for (const t of [
    'Double-check your work before finishing.', 'Double-check your work.', 'Be thorough and careful.', 'Be thorough.', 'Be careful.',
    'Stay in scope.', 'Read files before editing.', 'Read the file before modifying it.', 'Reuse existing code.',
    'Never edit tests to make them pass.', "Don't edit the tests to make them pass.", 'Reply in the configured language.',
    "Answer in the user's language.", 'Siempre revisa tu trabajo antes de terminar.', 'Comprueba dos veces tu código.',
    'Sé minucioso.', 'Sé cuidadoso y minucioso.',
  ]) assert.equal(ask(t), null, t);
  assert.equal(ask('Write clean code. Handle errors properly. Be thorough.'), null); // "Be thorough" is left over
});

test('file filler names the file it is about', () => {
  for (const t of ['Keep it updated.', 'Keep it up to date.', 'Mantenlo actualizado.', 'Keep it current as the project evolves.']) assert.equal(ask(t), null, t);
  for (const t of ['Keep this file updated.', 'Keep this document up to date.', 'Keep CLAUDE.md up to date.', 'Keep AGENTS.md current.', 'Mantén este archivo actualizado.', 'Mantén este documento actualizado.']) {
    assert.equal(ask(t)?.code, 'file-filler', t);
  }
  // In the sentence after one about this file, "it" is that file.
  assert.equal(ask('This file gives Claude context about the Ledger project. Keep it updated.')?.code, 'file-filler');
});
