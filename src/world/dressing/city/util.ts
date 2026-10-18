// Small placement helpers shared by the city dressing modules: zone runs, road-level mounting,
// facing yaws and HDR colours.
import { Color, Matrix4, Vector3 } from 'three';
import type { MeshBuf } from '../../geom';
import { box } from '../../kit/shapes';
import type { WorldCtx } from '../../ctx';
import type { Spot } from '../../scenery/place';
import { yawFor } from '../../scenery/signs/boards';
import type { City } from './city';

/** Merged [s0, s1, name] runs of the named zones, in street order. */
export function zoneRuns(ctx: WorldCtx, names: readonly string[]): Array<[number, number, string]> {
  const out: Array<[number, number, string]> = [];
  for (const z of ctx.L.zones) {
    if (!names.includes(z.name)) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last[1] - z.s0) < 0.5) last[1] = z.s1;
    else out.push([z.s0, z.s1, z.name]);
  }
  return out;
}

/** Name of the zone at s ('' outside every zone). */
export function zoneAt(ctx: WorldCtx, s: number): string {
  for (const z of ctx.L.zones) if (s >= z.s0 && s < z.s1) return z.name;
  return '';
}

export interface Mount { sp: Spot; y: number; onDeck: boolean }

/**
 * Road-level mount for a roadside item at (s, side, u beyond the drivable edge): the ground when it
 * lies at road level, the parapet top over drops (viaduct, bridge, quay — u is clamped onto the
 * parapet), null where the ground rises above the road (underpass cuttings) or inside the tunnel.
 */
export function mount(c: City, s: number, side: -1 | 1, u: number): Mount | null {
  const { ctx, field, place } = c.d;
  if (ctx.q.edgeKindAt(s, side) === 'tunnel') return null;
  const edge = field.edgeY(s, side);
  const sp = place.spot(s, side, u);
  if (sp.pos.y > edge + 0.8) return null;
  if (sp.pos.y >= edge - 0.8) return { sp, y: sp.pos.y, onDeck: false };
  const deck = place.spot(s, side, 0.19);
  return { sp: deck, y: edge + 0.92, onDeck: true };
}

/** Yaw of a face looking back down the road (toward oncoming riders), turned `turn` toward the road. */
export function towardRiders(ctx: WorldCtx, s: number, side: -1 | 1, turn = 0.3): number {
  const fr = ctx.q.frameVis(s);
  const tl = Math.hypot(fr.tangent.x, fr.tangent.z) || 1, rl = Math.hypot(fr.right.x, fr.right.z) || 1;
  const nx = (-fr.tangent.x / tl) * Math.cos(turn) - side * (fr.right.x / rl) * Math.sin(turn);
  const nz = (-fr.tangent.z / tl) * Math.cos(turn) - side * (fr.right.z / rl) * Math.sin(turn);
  return yawFor(nx, nz);
}

/** World point at track (s, x) on the road surface + y. */
export function roadPoint(ctx: WorldCtx, s: number, x: number, y = 0): Vector3 {
  return ctx.q.toWorld(s, x, y, new Vector3());
}

/** Colour × k (HDR values for unlit glow so bloom picks them up). */
export function hdr(hex: string, k: number): Color {
  return new Color(hex).multiplyScalar(k);
}

const SEG_UP = new Vector3(0, 1, 0);

/** Thin box from a to b (square section r), e.g. cables, struts. */
export function segment(buf: MeshBuf, a: Vector3, b: Vector3, r: number, col: Color): void {
  const len = a.distanceTo(b);
  if (len < 1e-4) return;
  const rot = new Matrix4().lookAt(a, b, Math.abs(b.y - a.y) > len * 0.99 ? new Vector3(1, 0, 0) : SEG_UP);
  const mm = new Matrix4().makeTranslation((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2).multiply(rot).multiply(new Matrix4().makeScale(r, r, len));
  box(buf, mm, col);
}

/** Points along a sagging cable from a to b (n segments, sag in metres at mid-span). */
export function catenary(a: Vector3, b: Vector3, sag: number, n: number): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(new Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t)));
  }
  return out;
}
