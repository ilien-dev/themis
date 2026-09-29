// Invoice lines: coupon may be null; expired coupons are ignored.
export function invoiceTotal(subtotalCents, coupon, today = new Date()) {
  if (!coupon || (coupon.expires && new Date(coupon.expires) < today)) return subtotalCents;
  let discount = 0;
  if (coupon.type === 'percent') discount = Math.round((subtotalCents * coupon.value) / 100);
  if (coupon.type === 'fixed') discount = coupon.value;
  return Math.max(0, subtotalCents - discount);
}
