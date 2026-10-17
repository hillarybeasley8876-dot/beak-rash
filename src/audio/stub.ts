// STUB kept by core for isolation tests (?stub=...) and as load fallback. The audio unit owns index.ts: silent.
// Contract: createAudio(app) → AudioSystem (core/contracts.ts).
import type { AppContext, AudioSystem } from '../core/contracts';

export function createAudio(app: AppContext): AudioSystem {
  void app;
  return {
    unlock: async () => undefined,
    music() {},
    sfx() {},
    voice() {},
    setMuffle() {},
    update() {},
    setVolumes() {},
  };
}
