export function createTask(body) {
  return { status: 201, body: { title: body.title, estimateHours: body.estimateHours } };
}
