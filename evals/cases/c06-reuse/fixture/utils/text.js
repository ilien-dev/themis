// Shared string helpers.
export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
export const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
