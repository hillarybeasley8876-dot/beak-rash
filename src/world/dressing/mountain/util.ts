// Small helpers shared by the Sunset Pass dressing modules.
import type { WorldCtx } from '../../ctx';

/** All zone ranges with this name (a zone name may repeat along the road). */
export function zones(ctx: WorldCtx, name: string): Array<{ s0: number; s1: number }> {
  return ctx.L.zones.filter((z) => z.name === name).map((z) => ({ s0: z.s0, s1: z.s1 }));
}

/** World point at track (s, x) on the horizontal plane (y from the exact ground). */
export function worldAt(ctx: WorldCtx, s: number, x: number): { x: number; y: number; z: number } {
  const fr = ctx.q.frameVis(s);
  const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const wx = fr.pos.x + (fr.right.x / rl) * x, wz = fr.pos.z + (fr.right.z / rl) * x;
  return { x: wx, y: ctx.ground(s, x), z: wz };
}
