import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../fx.js';
test('usd to eur', () => assert.equal(convert(10000, 'USD', 'EUR'), 9137));
test('gbp to jpy', () => assert.equal(convert(500, 'GBP', 'JPY'), 95315));
