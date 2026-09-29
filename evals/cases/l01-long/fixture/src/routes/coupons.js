export function createCoupon(body) {
  return { status: 201, body: { code: body.code, percent: body.percent } };
}
