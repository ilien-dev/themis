export function createTeam(body) {
  return { status: 201, body: { name: body.name, size: body.size } };
}
