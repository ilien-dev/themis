export function computePrice(item, qty, coupon) {
  if (!Number.isInteger(qty) || qty <= 0) throw new RangeError('qty must be a positive integer');
  let cents = item.unitCents * qty;
  let discount = 0;
  if (qty >= 10) discount = Math.round(cents * 0.1);
  if (item.clearance) discount = Math.max(discount, Math.round(cents * 0.25));
  if (coupon && coupon.code === 'WELCOME' && !item.clearance) discount += 500;
  if (discount > cents * 0.5) discount = Math.floor(cents * 0.5);
  cents -= discount;
  if (item.taxable !== false) cents += Math.round(cents * 0.08);
  return cents;
}
