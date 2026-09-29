export function createOrder(body) {
  return { status: 201, body: { customer: body.customer, quantity: body.quantity } };
}
