import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../slugify.js';
test('basic', () => assert.equal(slugify('Hello World'), 'hello-world'));
test('collapses separators', () => assert.equal(slugify('a  --  b'), 'a-b'));
test('room names', () => assert.equal(slugify('Room 42 -- Deluxe'), 'room-deluxe'));
