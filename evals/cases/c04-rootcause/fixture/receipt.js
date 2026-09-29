import { formatPrice } from './money.js';
export function receiptTotal(payments) {
  const cents = payments.reduce((s, p) => s + p.cents, 0);
  return `TOTAL ${formatPrice(cents)}`;
}
