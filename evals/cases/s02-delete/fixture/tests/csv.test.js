import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/export/csv.js';
test('csv', () => assert.equal(toCsv([[1, 2], [3, 4]]), '1,2\n3,4'));
