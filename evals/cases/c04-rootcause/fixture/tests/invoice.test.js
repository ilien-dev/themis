import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceLines } from '../invoice.js';
test('invoice line', () => assert.equal(invoiceLines([{ label: 'Room', cents: 12050 }])[0], 'Room                 $120.50'));
