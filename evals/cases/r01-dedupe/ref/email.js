// Order e-mail summary: shows the discounted total; negative totals are allowed here
// because refunds reuse this template.
export function emailTotal(subtotalCents, coupon) {
  let discount = 0;
  if (coupon && coupon.type === 'percent') discount = Math.round((subtotalCents * coupon.value) / 100);
  if (coupon && coupon.type === 'fixed') discount = coupon.value;
  return subtotalCents - discount;
}
