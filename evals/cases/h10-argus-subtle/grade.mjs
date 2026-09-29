export default async ({ final }) => {
  const order = /order|createdAt,text|id,createdAt/i.test(final) && /(column|header)/i.test(final);
  const ctype = /content-type|text\/csv|header/i.test(final) && /(missing|not set|isn't set|never set|no content-type|doesn't set|does not set)/i.test(final);
  const idChange = /Date\.now|id (generation|scheme)|sequential/i.test(final);
  const trim = /trim/i.test(final);
  const escaping = /(escap|quot|comma)/i.test(final);
  const hits = [order, ctype, idChange, trim].filter(Boolean).length;
  return { pass: hits === 4, notes: `order=${order} contentType=${ctype} idChange=${idChange} trim=${trim} escaping=${escaping}`, metric: hits };
};
