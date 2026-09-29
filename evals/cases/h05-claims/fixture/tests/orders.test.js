import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderTotal } from '../src/lines.js';
const order = JSON.parse(readFileSync(new URL('./fixtures/order.json', import.meta.url)));
test('order total', () => assert.equal(orderTotal(order.lines), 5000));
