import { bus } from './bus.js';
export const log = [];
bus.on('user:created', (u) => log.push(`created ${u.email}`));
export const createUser = (u) => { bus.emit('user:created', u); return u; };
