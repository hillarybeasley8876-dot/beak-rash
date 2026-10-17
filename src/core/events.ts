// Typed event bus. Handlers that throw are reported once per (event, handler) and never break the emitter,
// so a buggy FX or UI listener cannot stop the race simulation.

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();
  private reported = new WeakSet<Handler<never>>();

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(type, fn);
  }

  once<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off<K extends keyof E>(type: K, fn: Handler<E[K]>): void {
    this.handlers.get(type)?.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try {
        (fn as Handler<E[K]>)(payload);
      } catch (err) {
        if (!this.reported.has(fn)) {
          this.reported.add(fn);
          console.error(`[bus] handler for "${String(type)}" threw`, err);
        }
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
