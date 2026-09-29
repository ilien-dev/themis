const notes = [];
export const listNotes = () => notes;
export function addNote(text) {
  const note = { id: notes.length + 1, text, createdAt: new Date().toISOString() };
  notes.push(note);
  return note;
}
