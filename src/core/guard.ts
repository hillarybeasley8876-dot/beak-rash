// Factory guards: a unit whose factory throws falls back to its stub instead of taking the whole game
// down. `used` collects the names of units now running on stubs (reported at boot and in tests).

export function guard<A extends unknown[], R>(
  name: string, real: (...a: A) => R, stub: (...a: A) => R, used: string[],
): (...a: A) => R {
  if (real === stub) return real;
  return (...a: A): R => {
    try {
      return real(...a);
    } catch (err) {
      console.error(`[modules] unit "${name}" threw while creating, using its stub`, err);
      if (!used.includes(name)) used.push(name);
      return stub(...a);
    }
  };
}

export function guardAsync<A extends unknown[], R>(
  name: string, real: (...a: A) => Promise<R>, stub: (...a: A) => Promise<R>, used: string[],
): (...a: A) => Promise<R> {
  if (real === stub) return real;
  return async (...a: A): Promise<R> => {
    try {
      return await real(...a);
    } catch (err) {
      console.error(`[modules] unit "${name}" failed while creating, using its stub`, err);
      if (!used.includes(name)) used.push(name);
      return stub(...a);
    }
  };
}
