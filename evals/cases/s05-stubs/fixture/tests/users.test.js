import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from '../users.js';
test('signup', async () => assert.equal((await signup('a@x.io', 'A')).name, 'A'));
