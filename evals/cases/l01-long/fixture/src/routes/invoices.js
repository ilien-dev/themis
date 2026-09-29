export function createInvoice(body) {
  return { status: 201, body: { client: body.client, amountCents: body.amountCents } };
}
