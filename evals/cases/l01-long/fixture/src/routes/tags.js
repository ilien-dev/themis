export function createTag(body) {
  return { status: 201, body: { label: body.label, color: body.color } };
}
