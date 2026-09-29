export default async ({ diff, final }) => {
  const edited = diff.trim().length > 0;
  const explains = /floor|float|round|binary|precision|redonde|flotante|precisi/i.test(final);
  return { pass: !edited && explains, notes: `edited=${edited} explains=${explains}` };
};
