// Yield to the browser between long build steps so the loading screen keeps painting.
// No-op while the page is hidden (background timers are throttled to ~1 s).
export function breathe(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** For long build loops: `await tick()` breathes once `ms` of work ran since the last yield (the loading
 *  screen keeps painting; the work and its rng order stay the same). */
export function slicer(ms = 30): () => Promise<void> {
  let t = performance.now();
  return async () => {
    if (performance.now() - t < ms) return;
    await breathe();
    t = performance.now();
  };
}
