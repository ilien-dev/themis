import { getUser } from './api.js';
export async function loadBilling(id) {
  const user = await getUser(id);
  return { id, name: user.name, section: 'billing' };
}
