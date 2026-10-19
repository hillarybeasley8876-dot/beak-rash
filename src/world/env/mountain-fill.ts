// Sunset Pass sky fill (env-mountain): a cool cyan-blue directional light from the sky opposite the low
// sun, without shadows. The orange key keeps the sunlit sides golden, while shaded and back-lit sides
// (the riders' backs whenever the road heads into the sun, the asphalt, the sun shadows) pick up the
// cool sky instead of turning salmon / brown: whites stay white and riders separate from the road.
// Sky light cannot reach into a tunnel: the fill fades with the cube of the sun's tunnel dimming
// (env/lights.ts scales the sun's intensity under a roof), so the sodium-lit bore stays warm.
import { DirectionalLight } from 'three';
import type { WorldCtx } from '../ctx';

const FILL = { color: '#8fe0ff', intensity: 0.8, elevation: 0.5 } as const;

export function buildSkyFill(ctx: WorldCtx): void {
  const { dir } = ctx.look.sun;
  const h = Math.hypot(dir.x, dir.z) || 1;
  const fill = new DirectionalLight(FILL.color, FILL.intensity);
  fill.name = 'mountain:skyFill';
  // A directional light shines from its position toward its target (the origin): put it over the
  // horizon the sunlight travels toward, raised by the elevation.
  const c = Math.cos(FILL.elevation);
  fill.position.set((dir.x / h) * c, Math.sin(FILL.elevation), (dir.z / h) * c).multiplyScalar(100);
  ctx.group.add(fill);
  ctx.own(fill);
  let sun: DirectionalLight | null | undefined;
  ctx.onUpdate(() => {
    if (sun === undefined) {
      const o = ctx.group.getObjectByName('sun');
      sun = o instanceof DirectionalLight ? o : null;
      if (!sun) console.warn('[mountain] sky fill: no sun light found, tunnel dimming off');
    }
    if (sun) fill.intensity = FILL.intensity * (sun.intensity / ctx.look.sun.intensity) ** 3;
  });
}
