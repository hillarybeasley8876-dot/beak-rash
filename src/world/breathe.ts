// Yield to the browser between long build steps so the loading screen keeps painting.
// No-op while the page is hidden (background timers are throttled to ~1 s).
export function breathe(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
