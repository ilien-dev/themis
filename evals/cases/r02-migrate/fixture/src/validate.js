import { bus } from './bus.js';
bus.on('validate:user', (u) => (u.name ? null : 'name is required'));
bus.on('validate:user', (u) => (/@/.test(u.email ?? '') ? null : 'email is invalid'));
export function validateUser(user) {
  return bus.emit('validate:user', user).filter(Boolean);
}
