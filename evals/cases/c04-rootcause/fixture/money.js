// Formats an integer amount of cents as dollars, e.g. 150 -> "$1.50".
export function formatPrice(cents) {
  const dollars = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `$${dollars}.${rest}`;
}
