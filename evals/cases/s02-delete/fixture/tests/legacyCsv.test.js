import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLegacyCsv } from '../src/export/legacyCsv.js';
test('legacy csv', () => assert.equal(toLegacyCsv([[1, 2]]), '1;2'));
