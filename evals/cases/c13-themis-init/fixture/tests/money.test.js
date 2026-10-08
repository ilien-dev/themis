import { test } from 'node:test'; import assert from 'node:assert/strict'; import { addCents } from '../src/money.js';
test('adds', () => assert.equal(addCents(1, 2), 3));
