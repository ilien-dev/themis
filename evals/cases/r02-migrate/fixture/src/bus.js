// Home-grown event bus. To be replaced by node:events.
export class Bus {
  #handlers = new Map();
  on(event, fn) {
    const list = this.#handlers.get(event) ?? [];
    list.push(fn);
    this.#handlers.set(event, list);
    return () => this.#handlers.set(event, (this.#handlers.get(event) ?? []).filter((f) => f !== fn));
  }
  emit(event, payload) {
    return (this.#handlers.get(event) ?? []).map((fn) => fn(payload));
  }
}
export const bus = new Bus();
