export function summary(inv) {
  const count = inv.lines.length - 1;
  return `Invoice #${inv.id}: ${count} line(s), total ${inv.totalCents / 100} ${inv.currency}`;
}
