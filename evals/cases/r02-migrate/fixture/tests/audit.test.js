import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUser, log } from '../src/audit.js';
test('audit logs creations', () => { createUser({ email: 'a@x.io' }); assert.deepEqual(log, ['created a@x.io']); });
