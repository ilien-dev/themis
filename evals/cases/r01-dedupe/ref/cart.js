// Cart preview: percent coupons, rounded to the nearest cent.
export function cartTotal(subtotalCents, coupon) {
  let discount = 0;
  if (coupon && coupon.type === 'percent') discount = Math.round((subtotalCents * coupon.value) / 100);
  if (coupon && coupon.type === 'fixed') discount = coupon.value;
  return Math.max(0, subtotalCents - discount);
}
