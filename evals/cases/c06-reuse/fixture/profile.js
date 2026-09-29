import { capitalize, truncate } from './utils/text.js';
export const profileTitle = (u) => truncate(`${capitalize(u.name)} — ${u.role}`, 40);
