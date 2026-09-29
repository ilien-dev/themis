import { getUser } from './api.js';
export async function loadProfile(id) {
  const user = await getUser(id);
  return { id, name: user.name, section: 'profile' };
}
