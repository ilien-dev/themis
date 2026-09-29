import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warm, get } from '../cache.js';

test('warm fills the cache', async () => {
  warm(['a', 'b']);
  await new Promise((r) => setTimeout(r, 12));
  assert.equal(get('a'), 'value:a');
  assert.equal(get('b'), 'value:b');
});
