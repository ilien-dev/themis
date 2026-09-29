import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stars } from '../src/stars.js';
test('lamp', () => assert.equal(stars('lamp'), '4.5 stars'));
