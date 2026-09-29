export function createProject(body) {
  return { status: 201, body: { title: body.title, budgetCents: body.budgetCents } };
}
