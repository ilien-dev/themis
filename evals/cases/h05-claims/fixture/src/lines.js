export const lineTotal = (l) => l.cents * l.qty;
export const orderTotal = (lines) => lines.reduce((s, l) => s + lineTotal(l), 0);
