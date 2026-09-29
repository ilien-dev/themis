// Line prices are in dollars as they come from the catalog API.
export function orderTotal(lines) {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  return Math.floor(total * 100) / 100;
}
