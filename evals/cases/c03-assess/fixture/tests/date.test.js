import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate } from '../date.js';
test('parses ISO dates', () => assert.equal(parseDate('2024-03-15').toISOString(), '2024-03-15T00:00:00.000Z'));
