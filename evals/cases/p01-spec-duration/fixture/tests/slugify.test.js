import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/index.js';
test('slugify', () => assert.equal(slugify(' Hello World '), 'hello-world'));
