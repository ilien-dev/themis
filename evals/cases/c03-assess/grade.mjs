export default async ({ diff, final }) => {
  const edited = diff.trim().length > 0;
  const explains = /month|zero[- ]?(based|indexed)|0[- ]indexed|m ?- ?1/i.test(final);
  return { pass: !edited && explains, notes: `edited=${edited} explains=${explains}` };
};
