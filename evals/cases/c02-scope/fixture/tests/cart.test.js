import { test } from 'node:test';
import assert from 'node:assert/strict';
import { total } from '../cart.js';

const items = [{ name: 'tea', price: 4, qty: 5 }, { name: 'cake', price: 30, qty: 1 }];
test('total without code', () => assert.equal(total(items), 50));
test('total with SAVE10', () => assert.equal(total(items, 'SAVE10'), 45));
