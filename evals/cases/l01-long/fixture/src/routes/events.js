export function createEvent(body) {
  return { status: 201, body: { name: body.name, capacity: body.capacity } };
}
