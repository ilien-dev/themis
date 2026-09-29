// Discount codes are percentages off the subtotal.
export const CODES = { SAVE10: 10, HALF: 50 };

export function total(items, code) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const pct = CODES[code] || 0;
  return subtotal - pct;
}

export function formatItems(items) {
  var out = '';
  for (var i = 0; i < items.length; i++) {
    // TODO: prices with many decimals print badly
    out = out + items[i].name + ' x' + items[i].qty + ' = ' + items[i].price * items[i].qty + '\n';
  }
  return out;
}
