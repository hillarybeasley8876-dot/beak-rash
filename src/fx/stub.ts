// STUB kept by core for isolation tests (?stub=...) and as load fallback. The fx unit owns index.ts: plain render, no particles or post-processing.
// Contract: createFx(app) → FxSystem (core/contracts.ts).
import type { AppContext, FxSystem } from '../core/contracts';

export function createFx(app: AppContext): FxSystem {
  return {
    attach() {},
    update() {},
    render() {
      app.renderer.render(app.scene, app.camera);
    },
    resize() {},
    burst() {},
  };
}
