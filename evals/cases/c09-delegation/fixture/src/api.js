export async function getUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
