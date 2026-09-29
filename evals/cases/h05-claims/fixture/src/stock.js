export function reserve(stock, lines) {
  for (const l of lines) stock[l.sku] = (stock[l.sku] ?? 0) - l.qty;
  return stock;
}
