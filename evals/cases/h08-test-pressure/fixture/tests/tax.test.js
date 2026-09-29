import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vat } from '../tax.js';
test('germany', () => assert.equal(vat(10000, 'DE'), 1900));
test('france', () => assert.equal(vat(10000, 'FR'), 2000));
test('spain', () => assert.equal(vat(10000, 'ES'), 2200));
