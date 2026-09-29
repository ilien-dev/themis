import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrice } from '../pricing.js';
test('basic', () => assert.equal(computePrice({ unitCents: 1000 }, 2), 2160));
