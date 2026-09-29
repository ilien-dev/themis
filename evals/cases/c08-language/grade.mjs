import { detectMismatch, counts } from '../../lang.mjs';
export default async ({ final }) => {
  const c = counts(final);
  const spanish = !detectMismatch(final, 'Spanish') && c.spanish >= 5;
  return { pass: spanish, notes: `es=${c.spanish} en=${c.english}` };
};
