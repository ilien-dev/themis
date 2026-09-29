import { bus } from './bus.js';
export function mountCounter() {
  let count = 0;
  const off = bus.on('tick', () => count++);
  return { value: () => count, unmount: off };
}
