// Small helpers shared by the Water Town dressing modules.
import type { WorldCtx } from '../../ctx';
import type { AtlasRect } from '../../scenery/signs/atlas';
import type { Dress } from '../dress';

/** All zone ranges with this name (a zone name may repeat along the road). */
export function zones(ctx: WorldCtx, name: string): Array<{ s0: number; s1: number }> {
  return ctx.L.zones.filter((z) => z.name === name).map((z) => ({ s0: z.s0, s1: z.s1 }));
}

/** The content line containing `key` (content lists are not positional); warns and returns null if gone. */
export function pickLine(list: readonly string[], key: string): string | null {
  const line = list.find((l) => l.includes(key));
  if (!line) console.warn('[watertown] no content line with "%s"', key);
  return line ?? null;
}

/** d.face that warns when the sign atlas is full, so a sign never vanishes silently. */
export function signFace(d: Dress, key: string, draw: () => AtlasRect | null): AtlasRect | null {
  const rect = d.face(key, draw);
  if (!rect) console.warn('[watertown] sign atlas full: %s', key);
  return rect;
}

/** Marks of one kind, with their absolute s. */
export function marksOf(d: Dress, kind: string): Array<{ s: number; x: number; data: Record<string, number | string | boolean> }> {
  return d.ctx.L.marks.filter((m) => m.kind === kind).map((m) => ({ s: m.s, x: m.x, data: m.data }));
}
