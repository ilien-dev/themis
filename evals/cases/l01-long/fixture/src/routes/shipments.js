export function createShipment(body) {
  return { status: 201, body: { carrier: body.carrier, weightGrams: body.weightGrams } };
}
