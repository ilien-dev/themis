export class ValidationError extends Error { constructor(field, msg) { super(`${field}: ${msg}`); this.field = field; this.status = 400; } }
export const requireString = (body, field, max = 200) => {
  const v = body?.[field];
  if (typeof v !== 'string' || !v.trim()) throw new ValidationError(field, 'required');
  if (v.length > max) throw new ValidationError(field, `max ${max} chars`);
  return v.trim();
};
export const requireInt = (body, field, min = 0) => {
  const v = body?.[field];
  if (!Number.isInteger(v) || v < min) throw new ValidationError(field, `integer >= ${min}`);
  return v;
};
