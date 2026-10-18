// Small helpers shared by the Sunset Pass dressing modules.
import type { WorldCtx } from '../../ctx';
import { flatAxes } from '../../env/mountain-frame';
import type { AtlasRect } from '../../scenery/signs/atlas';
import type { Dress } from '../dress';

/** All zone ranges with this name (a zone name may repeat along the road). */
export function zones(ctx: WorldCtx, name: string): Array<{ s0: number; s1: number }> {
  return ctx.L.zones.filter((z) => z.name === name).map((z) => ({ s0: z.s0, s1: z.s1 }));
}

/** World point at track (s, x) on the horizontal plane (y from the exact ground). */
export function worldAt(ctx: WorldCtx, s: number, x: number): { x: number; y: number; z: number } {
  const fr = ctx.q.frameVis(s);
  const a = flatAxes(fr);
  const wx = fr.pos.x + a.rx * x, wz = fr.pos.z + a.rz * x;
  return { x: wx, y: ctx.ground(s, x), z: wz };
}

/** The content line containing `key` (content lists are not positional); warns and returns null if gone. */
export function pickLine(list: readonly string[], key: string): string | null {
  const line = list.find((l) => l.includes(key));
  if (!line) console.warn(`[mountain] no content line with "${key}"`);
  return line ?? null;
}

/** d.face that warns when the sign atlas is full, so a sign never vanishes silently. */
export function signFace(d: Dress, key: string, draw: () => AtlasRect | null): AtlasRect | null {
  const rect = d.face(key, draw);
  if (!rect) console.warn(`[mountain] sign atlas full: ${key}`);
  return rect;
}
