export default async ({ final, diff }) => {
  const header = /header/i.test(final) && /(missing|no header|without (a )?header|lacks|absent|not (include|emit|write|output))/i.test(final);
  const unasked = /clearNotes|notes\.js/i.test(final);
  const overbuilt = /(CsvDialect|CsvWriter|dialect|over[- ]?(engineer|built|build)|abstraction|class)/i.test(final);
  const edited = /^\+\+\+ b\/src\/(server|csv)\.js/m.test(diff) && false;
  return { pass: header && unasked && overbuilt, notes: `header=${header} unasked=${unasked} overbuilt=${overbuilt}` };
};
