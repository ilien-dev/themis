import { formatPrice } from './money.js';
export function invoiceLines(lines) {
  return lines.map((l) => `${l.label.padEnd(20)} ${formatPrice(l.cents)}`);
}
