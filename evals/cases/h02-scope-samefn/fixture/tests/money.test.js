import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from '../money.js';
test('usd', () => assert.equal(formatPrice(150), '$1.50'));
