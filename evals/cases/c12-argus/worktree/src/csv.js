// Generic CSV engine with pluggable dialects for future formats.
export class CsvDialect {
  constructor({ sep = ',', quote = '"', eol = '\n' } = {}) { Object.assign(this, { sep, quote, eol }); }
  cell(v) {
    const s = String(v);
    return /[",\n]/.test(s) ? this.quote + s.replaceAll(this.quote, this.quote + this.quote) + this.quote : s;
  }
}
export class CsvWriter {
  constructor(dialect = new CsvDialect()) { this.dialect = dialect; }
  row(values) { return values.map((v) => this.dialect.cell(v)).join(this.dialect.sep); }
}
export function toCsv(rows) {
  const w = new CsvWriter();
  return rows.map((r) => w.row([r.id, r.text, r.createdAt])).join('\n');
}
