// Exact ground height queries for prop placement: road surface on the drivable area, the near
// ribbon's triangles beside it, the far grid's triangles beyond (props never float or sink).
import { Vector3 } from 'three';
import type { GroundFn, WorldCtx } from '../ctx';
import type { FarHeight } from './far';
import type { TerrainField } from './field';
import { ribbonHeight, type NearRibbon } from './near';

export interface GroundQueries {
  ground: GroundFn;
  /** Ground at a world point (nearest-track lookup first, so the near ribbons are exact too). */
  groundWorld: (wx: number, wz: number) => number;
}

export function makeGround(ctx: WorldCtx, field: TerrainField, ribbons: NearRibbon[], far: FarHeight): GroundQueries {
  const left = ribbons.find((r) => r.side < 0), right = ribbons.find((r) => r.side > 0);
  const p = new Vector3();
  const fr = ctx.q.frameVis(0);
  const ground: GroundFn = (s, x) => {
    const side: -1 | 1 = x < 0 ? -1 : 1;
    const bound = field.bound(s, side);
    const u = Math.abs(x) - bound;
    ctx.q.frameVis(s, fr);
    if (u <= 0) return fr.pos.y + fr.right.y * x;
    const rb = side < 0 ? left : right;
    const h = rb ? ribbonHeight(rb, s, u) : null;
    if (h !== null) return h;
    // Horizontal offset from the road edge, like the ribbon columns.
    const rl = Math.hypot(fr.right.x, fr.right.z) || 1;
    p.set(fr.pos.x + (fr.right.x / rl) * x, 0, fr.pos.z + (fr.right.z / rl) * x);
    const hf = far(p.x, p.z);
    return Number.isFinite(hf) ? hf : field.heightAt(s, x, p.x, p.z);
  };
  const groundWorld = (wx: number, wz: number): number => {
    const smp = field.sampleWorld(wx, wz);
    if (smp.u > 0 && smp.u < 50) return ground(smp.s, smp.x);
    const hf = far(wx, wz);
    return Number.isFinite(hf) ? hf : smp.h;
  };
  return { ground, groundWorld };
}
