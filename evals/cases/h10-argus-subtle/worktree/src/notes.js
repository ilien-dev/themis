const notes = [];
export const listNotes = () => notes;
export function addNote(text) {
  const note = { id: Date.now(), text: text.trim(), createdAt: new Date().toISOString() };
  notes.push(note);
  return note;
}
export const toCsv = (rows) => ['id,createdAt,text', ...rows.map((r) => `${r.id},${r.createdAt},${r.text}`)].join('\n');
