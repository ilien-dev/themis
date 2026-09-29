const users = new Map();
export async function signup(email, name) {
  if (users.has(email)) throw new Error('already registered');
  const user = { email, name, createdAt: new Date().toISOString() };
  users.set(email, user);
  return user;
}
export const getUser = (email) => users.get(email);
