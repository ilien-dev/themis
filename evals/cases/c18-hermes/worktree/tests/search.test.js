import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addNote, listNotes } from '../src/notes.js';
test('search is case-insensitive', () => { addNote('Buy MILK'); addNote('Call mom'); assert.deepEqual(listNotes('milk').map((n) => n.text), ['Buy MILK']); });
