// Checkout: same coupons, but percent discounts round DOWN (accounting rule),
// and fixed coupons cannot exceed half the subtotal.
export function checkoutTotal(subtotalCents, coupon) {
  let discount = 0;
  if (coupon && coupon.type === 'percent') discount = Math.floor((subtotalCents * coupon.value) / 100);
  if (coupon && coupon.type === 'fixed') discount = Math.min(coupon.value, Math.floor(subtotalCents / 2));
  return Math.max(0, subtotalCents - discount);
}
