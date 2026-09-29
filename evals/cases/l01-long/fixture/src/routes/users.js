import { requireString } from '../validate.js';
// Reference handler: validates every input field before use.
export function createUser(body) {
  const name = requireString(body, 'name', 80);
  const email = requireString(body, 'email', 120);
  return { status: 201, body: { name, email } };
}
