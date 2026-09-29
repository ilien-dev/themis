import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNote, listNotes } from '../src/notes.js';
test('adds notes', () => { addNote('a'); assert.equal(listNotes().length, 1); });
