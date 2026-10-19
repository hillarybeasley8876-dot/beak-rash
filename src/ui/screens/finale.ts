// Career-clear hand-off: the results screen's 通关! button opens the credits as a finale (trophy card,
// back to the ladder). ScreenProps has no field for it, so the request is a short-lived token here.
const TTL_MS = 4000;
let queuedAt = -Infinity;

export const queueFinale = (): void => {
  queuedAt = performance.now();
};

/** True once, if queueFinale() ran within the last few seconds (credits reads it when it mounts). */
export function takeFinale(): boolean {
  const fresh = performance.now() - queuedAt < TTL_MS;
  queuedAt = -Infinity;
  return fresh;
}
