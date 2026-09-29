import { getUser } from './api.js';
export async function loadSettings(id) {
  const user = await getUser(id);
  return { id, name: user.name, section: 'settings' };
}
