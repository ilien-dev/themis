import { getUser } from './api.js';
export async function loadAdmin(id) {
  const user = await getUser(id);
  return { id, name: user.name, section: 'admin' };
}
