export function createProduct(body) {
  return { status: 201, body: { sku: body.sku, stock: body.stock } };
}
